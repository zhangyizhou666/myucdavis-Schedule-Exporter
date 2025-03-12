# Aggie Schedule Mate: UC Davis Schedule Enhancement Tool

A Chrome extension that enhances your UC Davis Schedule Builder experience with color coding, professor ratings, time management tools, and calendar export functionality.

## Features

### Calendar Integration
- **Easy Schedule Export**: Export your class schedule to standard iCalendar (.ics) format
- **Calendar Compatibility**: Import into Google Calendar, Apple Calendar, Outlook, and other applications
- **Quarter Detection**: Automatically detects current quarter and sets appropriate dates
- **Instructor Information**: Includes instructor names and email addresses in events

### Visual Enhancements
- **Course Color Coding**:
  - **Blue**: Courses already in your schedule
  - **Green**: Available courses with open seats
  - **Yellow**: Full courses (no available seats)
  - **Red**: Courses that conflict with your current schedule
- **Status Labels**: Clear indicators showing course status in the bottom left corner
- **Sort by Color**: Organize courses with a convenient button that sorts by availability

### Professor Ratings
- **RateMyProfessor Integration**: View quality and difficulty ratings for professors
- **Google Search Links**: Easy access to search for professors not in the database
- **User-Added Ratings**: Add your own ratings for professors

### Time Management
- **Early Morning Detection**: Highlights classes that start at or before 9:00 AM
- **Late Night Detection**: Highlights classes that start at or after 6:00 PM
- **Hide/Show Functionality**: Toggle visibility of early morning and late night classes

### Interface Improvements
- **Modern UI**: Clean, responsive interface with UC Davis colors
- **Notification System**: Elegant notifications for user feedback
- **Collapsible Details**: Keep course information organized

## Installation

### From Chrome Web Store
1. Visit the [ScheduleMate Extension](https://chrome.google.com/webstore/detail/schedulemate/xxxxx) in the Chrome Web Store
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your Chrome toolbar

## Usage

### Calendar Export
1. Log in to your UC Davis Schedule Builder
2. Click the ScheduleMate icon in your Chrome toolbar
3. Choose whether to export all courses or only registered courses
4. Click "Export to Calendar"
5. Import the .ics file into your preferred calendar application

### Color Coding and Schedule Management
- **Automatic Color Coding**: Courses are automatically color-coded based on their status
- **Conflict Detection**: Courses that conflict with your schedule are highlighted in red
- **Sort Button**: Use the "Sort by Color" button in the bottom right to organize courses by availability

### Professor Ratings
- **Automatic Display**: Professor ratings appear next to professor names when available
- **Google Search**: Click "Google" link to search for professor ratings when not in database

### Time Management
- **Time Indicators**: Early morning classes show a ⏰ icon, late night classes show a 🌙 icon
- **Time Filtering**: Use "Hide Early/Late Classes" button to toggle visibility of inconvenient class times

## Privacy

ScheduleMate:
- Only accesses data on UC Davis websites
- Does not collect or transmit any personal information
- Works entirely within your browser
- Does not require any account creation or login

## Permissions

- **activeTab**: To access the current Schedule Builder page
- **storage**: To save your preferences and user-added professor ratings
- **downloads**: To save the .ics file to your computer
- **host permissions for ucdavis.edu**: To run on the Schedule Builder website

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This extension is not affiliated with, endorsed by, or in any way officially connected with UC Davis or RateMyProfessors. All product and university names are the registered trademarks of their original owners.
```
