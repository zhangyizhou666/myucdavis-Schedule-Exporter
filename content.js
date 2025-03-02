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
  const finalExamDates = [];
  console.log('Starting event extraction...');
  
  try {
    const courseItems = document.querySelectorAll('div[id^="t"][class*="CourseItem"]');
    console.log(`Found ${courseItems.length} total course items`);
    
    // First pass: collect all final exam dates
    courseItems.forEach(courseItem => {
      const isRegistered = courseItem.querySelector('div.statusIndicator.registered');
      if (!isRegistered) return;
      
      const finalExamElement = Array.from(courseItem.querySelectorAll('div')).find(div => 
        div.textContent?.includes('Final Exam:')
      );
      
      if (finalExamElement) {
        const examMatch = finalExamElement.textContent.match(/Final Exam:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}:\d{2})\s*(PM|AM)/i);
        if (examMatch) {
          const [_, month, day, year, time, period] = examMatch;
          const examTime = convertTime12to24(`${time} ${period}`);
          const examDate = new Date(year, month - 1, day, examTime.hours, examTime.minutes);
          finalExamDates.push(examDate);
        }
      }
    });
    
    // Find earliest final exam date if any exist
    //let untilDate = '20250320T235959';
    if (finalExamDates.length > 0) {
      const earliestExam = new Date(Math.min(...finalExamDates.map(d => d.getTime())));
      untilDate = `${earliestExam.getFullYear()}${(earliestExam.getMonth() + 1).toString().padStart(2, '0')}${(earliestExam.getDate()-2).toString().padStart(2, '0')}T235959`;
    }
    
    // Second pass: extract course information
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
        // Format course code to match desired format
        const shortCode = courseCode.replace(/(\w+)\s0*(\d+[A-Z]?)\s0*(\d+)/, "$1 $2");
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
                until: untilDate
              });
            }
          });
        }
        
        // Skip final exam extraction for now since Google Calendar has issues with it
        // We'll keep this commented in case we want to re-enable later
        /*
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
        */
        
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