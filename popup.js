// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Load user preferences
  chrome.storage.sync.get({
    conflictDetection: true,
    colorCoding: true,
    rmpIntegration: true,
    earlyMorningWarning: true,
    registeredOnly: true
  }, function(items) {
    document.getElementById('conflictDetection').checked = items.conflictDetection;
    document.getElementById('colorCoding').checked = items.colorCoding;
    document.getElementById('rmpIntegration').checked = items.rmpIntegration;
    document.getElementById('earlyMorningWarning').checked = items.earlyMorningWarning;
    document.getElementById('registeredOnly').checked = items.registeredOnly;
    
    // Set all features toggle based on all other toggles being checked
    document.getElementById('allFeatures').checked = 
      items.conflictDetection && 
      items.colorCoding && 
      items.rmpIntegration && 
      items.earlyMorningWarning;
  });

  // Save preferences when toggles change
  document.getElementById('conflictDetection').addEventListener('change', saveOptions);
  document.getElementById('colorCoding').addEventListener('change', saveOptions);
  document.getElementById('rmpIntegration').addEventListener('change', saveOptions);
  document.getElementById('earlyMorningWarning').addEventListener('change', saveOptions);
  document.getElementById('registeredOnly').addEventListener('change', saveOptions);

  // Apply preferences immediately when changed
  document.getElementById('conflictDetection').addEventListener('change', updateAllFeaturesToggle);
  document.getElementById('colorCoding').addEventListener('change', updateAllFeaturesToggle);
  document.getElementById('rmpIntegration').addEventListener('change', updateAllFeaturesToggle);
  document.getElementById('earlyMorningWarning').addEventListener('change', updateAllFeaturesToggle);
  
  document.getElementById('conflictDetection').addEventListener('change', applyPreferences);
  document.getElementById('colorCoding').addEventListener('change', applyPreferences);
  document.getElementById('rmpIntegration').addEventListener('change', applyPreferences);
  document.getElementById('earlyMorningWarning').addEventListener('change', applyPreferences);
  
  // All features toggle handling
  document.getElementById('allFeatures').addEventListener('change', function(e) {
    const isChecked = e.target.checked;
    
    // Update all feature toggles
    document.getElementById('conflictDetection').checked = isChecked;
    document.getElementById('colorCoding').checked = isChecked;
    document.getElementById('rmpIntegration').checked = isChecked;
    document.getElementById('earlyMorningWarning').checked = isChecked;
    
    // Save and apply the changes
    saveOptions();
    applyPreferences();
  });
  
  // Helper function to update the all features toggle
  function updateAllFeaturesToggle() {
    const allChecked = 
      document.getElementById('conflictDetection').checked && 
      document.getElementById('colorCoding').checked && 
      document.getElementById('rmpIntegration').checked && 
      document.getElementById('earlyMorningWarning').checked;
      
    document.getElementById('allFeatures').checked = allChecked;
  }
  
  // Handle Schedule Builder button click
  document.getElementById('goToScheduleBuilder').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://my.ucdavis.edu/schedulebuilder' });
  });

  // Extract events button
  document.getElementById('extractEvents').addEventListener('click', extractEvents);

  // Initial application of preferences
  applyPreferences();
});

function saveOptions() {
  chrome.storage.sync.set({
    conflictDetection: document.getElementById('conflictDetection').checked,
    colorCoding: document.getElementById('colorCoding').checked,
    rmpIntegration: document.getElementById('rmpIntegration').checked,
    earlyMorningWarning: document.getElementById('earlyMorningWarning').checked,
    registeredOnly: document.getElementById('registeredOnly').checked
  });
}

function applyPreferences() {
  const preferences = {
    conflictDetection: document.getElementById('conflictDetection').checked,
    colorCoding: document.getElementById('colorCoding').checked,
    rmpIntegration: document.getElementById('rmpIntegration').checked,
    earlyMorningWarning: document.getElementById('earlyMorningWarning').checked
  };

  // Send message to content script to apply preferences
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'applyPreferences',
      preferences: preferences
    });
  });
}

async function extractEvents() {
  try {
    const statusElement = document.getElementById('status');
    statusElement.textContent = 'Extracting schedule...';
    statusElement.className = '';
    
    // Get the toggle value for registered only
    const registeredOnly = document.getElementById('registeredOnly').checked;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'extractEvents',
      debug: true,
      registeredOnly: registeredOnly
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
        statusElement.textContent = 'Schedule exported successfully!';
        statusElement.className = 'status-success';
      }
    });

  } catch (error) {
    console.error('Error in popup script:', error);
    document.getElementById('status').textContent = `Error: ${error.message}`;
    document.getElementById('status').className = 'status-error';
  }
}

function generateICS(events) {
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Mate//UC Davis Schedule//EN',
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
        
        // Parse the quarter start date
        const year = parseInt(event.quarterStart.substring(0, 4));
        const month = parseInt(event.quarterStart.substring(4, 6)) - 1; // 0-based months
        const date = parseInt(event.quarterStart.substring(6, 8));
        
        // Create base date for first Monday of the quarter
        const baseDate = new Date(year, month, date);
        
        // Adjust for classes that start on different days of the week
        // If the quarter starts on a day other than Monday, we need to find the first occurrence
        // of each class day
        const startDayOfWeek = baseDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        let adjustedDaysToAdd = daysToAdd;
        
        // If quarter starts on Monday (1), no adjustment needed
        // If quarter starts on Tuesday (2), we need to add 6 days to get to Monday, then apply daysToAdd
        // If quarter starts on Wednesday (3), we need to add 5 days to get to Monday, etc.
        if (startDayOfWeek !== 1) { // If not Monday
          const daysToNextMonday = (8 - startDayOfWeek) % 7; // Days to next Monday
          adjustedDaysToAdd = (daysToAdd + daysToNextMonday) % 7;
        }
        
        const startDate = new Date(baseDate);
        startDate.setDate(startDate.getDate() + adjustedDaysToAdd);
        
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