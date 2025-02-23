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

        const [courseCode, ...titleParts] = courseTitle.split(' - ');
        const shortCode = courseCode.replace(/\s*0+(\d+[A-Z])\s*00\d/, ' $1');
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

              events.push({
                type: 'recurring',
                summary: `${shortCode} ${meetingInfo.type}`,
                description: `${courseName}`,
                location: meetingInfo.location || '',
                startTime: timeRange.start,
                endTime: timeRange.end,
                days: daysList,
                until: '20250320T235959'
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
            
            events.push({
              type: 'single',
              summary: `${shortCode} Final Exam`,
              description: `Final Exam for ${courseName}`,
              location: 'TBA',
              date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
              startTime: `${examTime.hours.toString().padStart(2, '0')}:${examTime.minutes.toString().padStart(2, '0')}`,
              duration: 2 // hours
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