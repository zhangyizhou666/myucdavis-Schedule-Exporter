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

function getQuarterDates() {
  // Look for the term selector text
  const termSelectorElement = document.getElementById('TermSelectorText2');
  if (!termSelectorElement) {
    console.log('Term selector not found, using default dates');
    return {
      startDate: '20250331', // Default: March 31, 2025 (Spring Quarter begins)
      endDate: '20250605',   // Default: June 5, 2025 (Spring Instruction ends)
      untilDate: '20250605T235959Z' // Default until date
    };
  }
  
  const termText = termSelectorElement.textContent.trim();
  console.log(`Detected term: ${termText}`);
  
  // Set dates based on academic calendar
  if (termText.includes('Spring') && termText.includes('2025')) {
    return {
      startDate: '20250331', // March 31, 2025 (Spring Instruction begins)
      endDate: '20250605',   // June 5, 2025 (Spring Instruction ends)
      untilDate: '20250605T235959Z'
    };
  } 
  else if (termText.includes('Winter') && termText.includes('2025')) {
    return {
      startDate: '20250106', // January 6, 2025 (Winter Instruction begins)
      endDate: '20250314',   // March 14, 2025 (Winter Instruction ends)
      untilDate: '20250314T235959Z'
    };
  }
  else if (termText.includes('Fall') && termText.includes('2024')) {
    return {
      startDate: '20240925', // September 25, 2024 (Fall Instruction begins)
      endDate: '20241206',   // December 6, 2024 (Fall Instruction ends)
      untilDate: '20241206T235959Z'
    };
  }
  else if (termText.includes('Fall') && termText.includes('2025')) {
    return {
      startDate: '20250924', // September 24, 2025 (Fall Instruction begins)
      endDate: '20251205',   // December 5, 2025 (Fall Instruction ends)
      untilDate: '20251205T235959Z'
    };
  }
  // Default to Spring 2025 if no match
  return {
    startDate: '20250331', // March 31, 2025 (Spring Instruction begins)
    endDate: '20250605',   // June 5, 2025 (Spring Instruction ends)
    untilDate: '20250605T235959Z'
  };
}

function extractEventsFromPage(options = {}) {
  const events = [];
  const registeredOnly = options.registeredOnly !== false; // Default to true if not specified
  console.log(`Starting extraction with registeredOnly=${registeredOnly}`);
  
  // Get quarter dates from the page or use defaults
  const quarterDates = getQuarterDates();
  console.log('Quarter dates:', quarterDates);
  
  try {
    // Find all course items that are NOT in the SaveForLaterCourses container
    const allCourseItems = document.querySelectorAll('div[id^="t"][class*="CourseItem"]');
    const courseItems = Array.from(allCourseItems).filter(item => {
      // Check if this item is inside a SaveForLaterCourses container
      return !item.closest('#SaveForLaterCourses');
    });
    
    console.log(`Found ${courseItems.length} course items (excluding saved for later courses)`);
    
    // Extract course information
    courseItems.forEach((courseItem, index) => {
      try {
        const isRegistered = courseItem.querySelector('div.statusIndicator.registered');
        if (registeredOnly && !isRegistered) {
          console.log('Skipping unregistered course');
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
                quarterStart: quarterDates.startDate,
                until: quarterDates.untilDate
              });
            }
          });
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
      const events = extractEventsFromPage({
        debug: request.debug,
        registeredOnly: request.registeredOnly
      });
      
      if (events.length > 0) {
        sendResponse({ events });
      } else {
        sendResponse({ error: 'No courses found on the page' });
      }
    } catch (error) {
      console.error('Error during extraction:', error);
      sendResponse({ error: error.message });
    }
  }
  return true;
});