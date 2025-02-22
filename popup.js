// popup.js
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('extractEvents').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'extractEvents',
          debug: true
        });
        
        if (response.error) {
          document.getElementById('status').textContent = `Error: ${response.error}`;
          return;
        }
  
        if (!response.events || response.events.length === 0) {
          document.getElementById('status').textContent = 'No events found';
          return;
        }
  
        document.getElementById('status').textContent = `Found ${response.events.length} events! Generating ICS file...`;
  
        const icsContent = generateICS(response.events);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
          url: url,
          filename: 'ucdavis-schedule.ics',
          saveAs: true
        });
  
      } catch (error) {
        console.error('Error in popup script:', error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
      }
    });
  });
  
  function padNumber(num) {
    return num.toString().padStart(2, '0');
  }
  
  function createEventDateTime(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  
  function getFirstDayOfWeek(dayCode) {
    const dayMap = {
      'MO': 1,
      'TU': 2,
      'WE': 3,
      'TH': 4,
      'FR': 5
    };
  
    // Start with January 6, 2025 (a Monday)
    const startDate = new Date(Date.UTC(2025, 0, 6));
    const targetDay = dayMap[dayCode];
  
    // Calculate days to add
    let daysToAdd = targetDay - 1; // -1 because we start with Monday (1)
    
    // Copy the date to avoid modifying the original
    const resultDate = new Date(startDate);
    resultDate.setUTCDate(startDate.getUTCDate() + daysToAdd);
    
    return resultDate;
  }
  
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
        event.daysOfWeek.forEach(day => {
          const baseDate = getFirstDayOfWeek(day);
          const [startHours, startMinutes] = event.startTime.match(/\d{2}/g).map(Number);
          const [endHours, endMinutes] = event.endTime.match(/\d{2}/g).map(Number);
  
          // Create the start date
          const startDate = new Date(baseDate);
          const endDate = new Date(baseDate);
          
          // If the event crosses midnight in UTC, add a day to both dates
          if (event.nextDay) {
            startDate.setUTCDate(startDate.getUTCDate() + 1);
            endDate.setUTCDate(endDate.getUTCDate() + 1);
          }
          
          startDate.setUTCHours(startHours, startMinutes);
          endDate.setUTCHours(endHours, endMinutes);
  
          // For debugging
          console.log(`Creating event: ${event.summary} on ${day}`);
          console.log(`Start date: ${startDate.toISOString()}`);
          console.log(`End date: ${endDate.toISOString()}`);
          console.log(`Next day: ${event.nextDay}`);
  
          icsContent = icsContent.concat([
            'BEGIN:VEVENT',
            `SUMMARY:${event.summary}`,
            `DESCRIPTION:${event.description}`,
            `RRULE:FREQ=WEEKLY;UNTIL=${event.until};BYDAY=${day}`,
            `DTSTART:${createEventDateTime(startDate)}`,
            `DTEND:${createEventDateTime(endDate)}`,
            `LOCATION:${event.location}`,
            'END:VEVENT'
          ]);
        });
      } else if (event.type === 'single') {
        // Parse final exam times
        try {
          const startDateStr = event.startDate.replace(/000ZZ$/, 'Z');
          const endDateStr = event.endDate.replace(/000ZZ$/, 'Z');
          
          console.log(`Final Exam: ${event.summary}`);
          console.log(`Start: ${startDateStr}`);
          console.log(`End: ${endDateStr}`);
  
          icsContent = icsContent.concat([
            'BEGIN:VEVENT',
            `SUMMARY:${event.summary}`,
            `DESCRIPTION:${event.description}`,
            `DTSTART:${startDateStr}`,
            `DTEND:${endDateStr}`,
            `LOCATION:${event.location}`,
            'END:VEVENT'
          ]);
        } catch (error) {
          console.error('Error processing final exam:', error);
        }
      }
    });
  
    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
  }