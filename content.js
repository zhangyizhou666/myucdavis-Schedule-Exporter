// content.js
function convertTime12to24(time12) {
  const [time, modifier] = time12.split(/\s*(AM|PM)/);
  let [hours, minutes] = time.split(':').map(Number);

  if (hours === 12) {
    hours = 0;
  }
  if (modifier === 'PM') {
    hours += 12;
  }

  return {
    hours: hours,
    minutes: minutes
  };
}

function parseTimeRange(timeText) {
  const [startTime12, endTime12] = timeText.split(' - ');
  const start = convertTime12to24(startTime12);
  const end = convertTime12to24(endTime12);

  return {
    start: `${start.hours.toString().padStart(2, '0')}:${start.minutes.toString().padStart(2, '0')}`,
    end: `${end.hours.toString().padStart(2, '0')}:${end.minutes.toString().padStart(2, '0')}`
  };
}

function extractEventsFromPage(debug = false) {
  const events = [];
  console.log('Starting event extraction...');

  try {
    const courseItems = document.querySelectorAll('div[id^="t"][class*="CourseItem"]');
    console.log(`Found ${courseItems.length} total course items`);

    courseItems.forEach((courseItem, index) => {
      try {
        const isRegistered = courseItem.querySelector('div.statusIndicator.registered');
        if (!isRegistered) {
          if (debug) console.log('Skipping unregistered course');
          return;
        }

        const courseTitle = courseItem.querySelector('.classTitle')?.textContent?.trim();
        if (!courseTitle) return;

        // Extract instructor information
        const instructorDiv = courseItem.querySelector('.classDescription a[href^="mailto:"]');
        let instructorText = '';
        if (instructorDiv) {
          const name = instructorDiv.textContent.trim();
          const email = instructorDiv.getAttribute('href').replace('mailto:', '');
          instructorText = `\\nInstructor: ${name} (${email})`;
        }

        const [courseCode, ...titleParts] = courseTitle.split(' - ');
        // Format course code to maintain leading zeros in section numbers
        const shortCode = courseCode
          .replace(/(\w+)\s*0*(\d+[A-Z]?)\s*0*(\d+)/, (_, dept, num, section) => 
            `${dept} ${num} ${section.padStart(3, '0')}`);
        const courseName = titleParts.join(' - ');

        const meetingTimesContainer = courseItem.querySelector('.data.meeting-times');
        if (meetingTimesContainer) {
          const meetings = meetingTimesContainer.querySelectorAll('.meeting.clearfix');

          meetings.forEach(meeting => {
            const elements = meeting.querySelectorAll('.float-left.height-justified');
            let meetingInfo = {
              type: '',
              time: '',
              days: '',
              location: ''
            };

            elements.forEach((element, index) => {
              const text = element.textContent.trim();
              if (element.classList.contains('smallTitle')) {
                meetingInfo.type = text;
              } else if (text.match(/\d+:\d+/)) {
                meetingInfo.time = text;
              } else if (text.match(/^[MTWRF]+$/)) {
                meetingInfo.days = text;
              } else if (index === elements.length - 1) {
                meetingInfo.location = text;
              }
            });

            if (meetingInfo.time && meetingInfo.days) {
              const timeRange = parseTimeRange(meetingInfo.time);
              const daysList = meetingInfo.days.split('');

              const locationText = meetingInfo.location ? 
                `\\nLocation: ${meetingInfo.location}` : '';

              events.push({
                type: 'recurring',
                summary: `${shortCode} ${meetingInfo.type}`,
                description: `${courseName}${instructorText}${locationText}`,
                location: meetingInfo.location || '',
                startTime: timeRange.start,
                endTime: timeRange.end,
                days: daysList,
                until: '20250320T235959Z'
              });
            }
          });
        }

        // Final exam handling
        const finalExamElement = Array.from(courseItem.querySelectorAll('div')).find(div => 
          div.textContent?.includes('Final Exam:')
        );
        
        if (finalExamElement) {
          const examMatch = finalExamElement.textContent.match(/Final Exam:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}:\d{2})\s*(PM|AM)/i);
          
          if (examMatch) {
            const [_, month, day, year, time, period] = examMatch;
            const examTime = convertTime12to24(`${time} ${period}`);
            
            // Calculate UTC time (add 8 hours for PST->UTC conversion)
            let utcHours = examTime.hours + 8;
            let utcDay = parseInt(day);
            if (utcHours >= 24) {
              utcHours -= 24;
              utcDay += 1;
            }
            
            const startDate = `${year}${month.padStart(2, '0')}${utcDay.toString().padStart(2, '0')}T${utcHours.toString().padStart(2, '0')}${examTime.minutes.toString().padStart(2, '0')}00Z`;
            const endDate = new Date(Date.UTC(year, month - 1, utcDay, utcHours, examTime.minutes));
            endDate.setUTCHours(endDate.getUTCHours() + 2); // Add 2 hours for duration
            const endDateStr = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
            
            events.push({
              type: 'single',
              summary: `${shortCode} Final Exam`,
              description: `Final Exam for ${courseName}`,
              location: 'TBA',
              startDate: startDate,
              endDate: endDateStr
            });
          }
        }

      } catch (courseError) {
        console.error(`Error processing course item ${index + 1}:`, courseError);
      }
    });

  } catch (error) {
    console.error('Error in main extraction:', error);
    throw error;
  }

  return events;
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractEvents') {
    try {
      const events = extractEventsFromPage(request.debug);
      if (events.length > 0) {
        sendResponse({ events });
      } else {
        sendResponse({ error: 'No registered courses found on the page' });
      }
    } catch (error) {
      console.error('Error during extraction:', error);
      sendResponse({ error: error.message });
    }
  }
  return true;
});