// content.js
console.log('Content script loaded for UC Davis Schedule Exporter');

function extractEventsFromPage(debug = false) {
  const events = [];
  console.log('Starting event extraction...');

  try {
    const courseItems = document.querySelectorAll('div[id^="t"][class*="CourseItem"]');
    console.log(`Found ${courseItems.length} total course items`);

    courseItems.forEach((courseItem, index) => {
      try {
        // Check if course is registered using the statusIndicator
        const isRegistered = courseItem.querySelector('div.statusIndicator.registered');
        if (!isRegistered) {
          if (debug) console.log('Skipping unregistered course');
          return;
        }

        // Get course details
        const courseTitle = courseItem.querySelector('.classTitle')?.textContent?.trim();
        if (!courseTitle) {
          console.log('No course title found, skipping');
          return;
        }

        const [courseCode, ...titleParts] = courseTitle.split(' - ');
        // Convert "ECS 032A 001" to "ECS 32A"
        const shortCode = courseCode.replace(/\s*0+(\d+[A-Z])\s*00\d/, ' $1');
        const courseName = titleParts.join(' - ');
        
        console.log(`Processing registered course: ${shortCode} (${courseCode})`);

        // Get meeting times
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
          
            // Process elements in order - they always follow the same pattern:
            // 1. Type (has smallTitle class)
            // 2. Time (contains time format)
            // 3. Days (contains single letters M,T,W,R,F)
            // 4. Location (last element)
            elements.forEach((element, index) => {
              const text = element.textContent.trim();
              if (element.classList.contains('smallTitle')) {
                meetingInfo.type = text;
              } else if (text.match(/\d+:\d+/)) {
                meetingInfo.time = text;
              } else if (text.match(/^[MTWRF]+$/)) {
                meetingInfo.days = text;
              } else if (index === elements.length - 1) { // Last element is always location
                meetingInfo.location = text;
              }
            });
          
            if (meetingInfo.time && meetingInfo.days) {
              const timeRange = parseTimeRange(meetingInfo.time);
              const byday = parseDaysToRRULE(meetingInfo.days);
              
              events.push({
                type: 'recurring',
                summary: `${shortCode} ${meetingInfo.type}`,
                description: `${courseName}`,
                location: meetingInfo.location || '',
                startTime: timeRange.start,
                endTime: timeRange.end,
                daysOfWeek: byday,
                nextDay: timeRange.nextDay,
                until: '20250320T235959Z' // End of winter quarter
              });
            }
          });
        }

        // Extract final exam
        const finalExamElement = Array.from(courseItem.querySelectorAll('div')).find(div => 
          div.textContent?.includes('Final Exam:')
        );
        
        if (finalExamElement) {
          const examMatch = finalExamElement.textContent.match(/Final Exam:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}:\d{2})\s*(PM|AM)/i);
          
          if (examMatch) {
            const [_, month, day, year, time, period] = examMatch;
            const startTime = convertTo24Hour(time, period);
            const [hours, minutes] = startTime.split(':').map(Number);
            
            const startDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
            const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // 2 hours duration
            
            events.push({
              type: 'single',
              summary: `${shortCode} Final Exam`,
              description: `Final Exam for ${courseName}`,
              location: 'TBA',
              startDate: formatUTCDate(startDate),
              endDate: formatUTCDate(endDate)
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

  console.log(`Extraction complete. Found ${events.length} events.`);
  return events;
}

function convertPacificToUTC(time, period) {
  // Parse time components
  let [hours, minutes] = time.split(':').map(Number);
  
  // Convert to 24-hour format
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  // Add 8 hours for Pacific -> UTC conversion
  const utcHours = hours + 8;
  
  // If we go past midnight, wrap around to next day
  if (utcHours >= 24) {
    return {
      hours: utcHours - 24,
      minutes: minutes,
      nextDay: true
    };
  }

  return {
    hours: utcHours,
    minutes: minutes,
    nextDay: false
  };
}

function parseTimeRange(timeText) {
  const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*(PM|AM)\s*-\s*(\d{1,2}:\d{2})\s*(PM|AM)/i);
  if (!timeMatch) {
    console.log('Could not parse time range:', timeText);
    return { start: null, end: null };
  }

  const start = convertPacificToUTC(timeMatch[1], timeMatch[2]);
  const end = convertPacificToUTC(timeMatch[3], timeMatch[4]);

  return {
    start: `${start.hours.toString().padStart(2, '0')}${start.minutes.toString().padStart(2, '0')}00`,
    end: `${end.hours.toString().padStart(2, '0')}${end.minutes.toString().padStart(2, '0')}00`,
    nextDay: start.nextDay
  };
}

function convertTo24Hour(time, period) {
  let [hours, minutes] = time.split(':').map(Number);
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatUTCDate(date) {
  return date.toISOString().replace(/[-:.]/g, '').split('.')[0] + 'Z';
}

function parseDaysToRRULE(daysText) {
  const dayMap = {
    'M': 'MO',
    'T': 'TU',
    'W': 'WE',
    'R': 'TH',
    'F': 'FR'
  };
  
  return daysText.split('').map(day => dayMap[day]).filter(Boolean);
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  
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

console.log('UC Davis Schedule Exporter content script ready');