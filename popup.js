// popup.js
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('extractEvents').addEventListener('click', async () => {
    try {
      const statusElement = document.getElementById('status');
      statusElement.textContent = 'Extracting schedule...';
      statusElement.className = '';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'extractEvents',
        debug: true
      });
      
      if (response.error) {
        statusElement.textContent = `Error: ${response.error}`;
        statusElement.className = 'status-error';
        return;
      }

      if (!response.events || response.events.length === 0) {
        statusElement.textContent = 'No events found';
        statusElement.className = 'status-error';
        return;
      }

      statusElement.textContent = `Found ${response.events.length} events! Generating ICS file...`;
      
      const icsContent = generateICS(response.events);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: 'ucdavis-schedule.ics',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          statusElement.textContent = `Error: ${chrome.runtime.lastError.message}`;
          statusElement.className = 'status-error';
        } else {
          statusElement.textContent = 'Schedule exported successfully! Open the file in your calendar app.';
          statusElement.className = 'status-success';
        }
      });

    } catch (error) {
      console.error('Error in popup script:', error);
      document.getElementById('status').textContent = `Error: ${error.message}`;
      document.getElementById('status').className = 'status-error';
    }
  });
});

function generateICS(events) {
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UC Davis Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach(event => {
    if (event.type === 'recurring') {
      // Convert days to correct format
      const dayMap = { 'M': 'MO', 'T': 'TU', 'W': 'WE', 'R': 'TH', 'F': 'FR' };
      
      // For each day the class meets
      event.days.forEach(day => {
        // Calculate days to add based on the day of the week
        const daysToAdd = {
          'M': 0,
          'T': 1,
          'W': 2,
          'R': 3,
          'F': 4
        }[day];
        
        const baseDate = new Date(2025, 0, 6); // Start with January 6, 2025 (Monday)
        const startDate = new Date(baseDate);
        startDate.setDate(startDate.getDate() + daysToAdd);
        
        const [startHours, startMinutes] = event.startTime.split(':').map(Number);
        const [endHours, endMinutes] = event.endTime.split(':').map(Number);
        
        startDate.setHours(startHours, startMinutes);
        const endDate = new Date(startDate);
        endDate.setHours(endHours, endMinutes);

        icsContent = icsContent.concat([
          'BEGIN:VEVENT',
          `SUMMARY:${event.summary}`,
          `DESCRIPTION:${event.description}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${event.until};BYDAY=${dayMap[day]}`,
          `DTSTART;TZID=America/Los_Angeles:${formatLocalDateTime(startDate)}`,
          `DTEND;TZID=America/Los_Angeles:${formatLocalDateTime(endDate)}`,
          `LOCATION:${event.location}`,
          'END:VEVENT'
        ]);
      });
    }
    // Single events (like final exams) are now handled in the content script
  });

  icsContent.push('END:VCALENDAR');
  return icsContent.join('\r\n');
}

function formatLocalDateTime(date) {
  return date.getFullYear() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') + 
    'T' +
    date.getHours().toString().padStart(2, '0') +
    date.getMinutes().toString().padStart(2, '0') +
    '00';
}