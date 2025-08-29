class StudyTimer {
    constructor() {
        this.timeLeft = 25 * 60; // Will be updated by loadSettings()
        this.isRunning = false;
        this.isPaused = false; // New state to track if timer is paused
        this.interval = null;
        this.startTime = null;
        this.studySessions = [];
        this.dataFile = 'study-data.json';
        this.lastDisplayDate = null; // Track when we last updated the display
        
        // Settings
        this.timerMode = 'timer'; // 'timer' or 'stopwatch'
        this.focusMinutes = 25;
        
        // Current editing session
        this.currentEditingIndex = -1;
        
        // Debug counter for pause button clicks
        this.pauseButtonClickCount = 0;
        
        // Hack mode
        this.hackMode = false;
        this.hackInput = '';
        
        // Store function references for proper event listener management
        this.startFunction = () => this.start();
        this.stopFunction = () => this.handleStop();
        this.pauseFunction = () => this.pause();
        this.resumeFunction = () => this.resume();
        
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.logBtn = document.getElementById('logBtn');
        this.timerDisplay = document.getElementById('timer');
        this.heatmapContainer = document.getElementById('heatmap');
        this.logContainer = document.getElementById('logContainer');
        this.progressBar = document.querySelector('.progress-bar');
        
        // Check environment
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname === '0.0.0.0';
        
        console.log('🚀 StudyTimer initializing...');
        console.log('🌐 Environment:', isLocalhost ? 'localhost' : 'production');
        console.log('🔧 Protocol:', window.location.protocol);
        console.log('🏠 Hostname:', window.location.hostname);
        
        this.setupEventListeners();
        this.setupTimerScrollEvents();
        this.loadStudySessions();
        this.loadSettings();
        this.updateDisplay(); // Update display after loading settings
        this.initializeProgressBar(); // Initialize progress bar visibility
        
        // Set up automatic daily refresh
        this.setupDailyRefresh();
        
        // Set up PWA install functionality
        this.setupPWAInstall();
        
        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        console.log('✅ StudyTimer initialized successfully');
        console.log('⏱️ Timer mode:', this.timerMode);
        console.log('⏰ Time left:', this.timeLeft, 'seconds');
        console.log('🎯 Focus minutes:', this.focusMinutes);
        console.log('⌨️ Keyboard shortcuts enabled');
    }
    

    
    setupDailyRefresh() {
        // Check if we need to refresh the display (date changed)
        const checkDateChange = () => {
            const today = this.getCurrentDate();
            if (this.lastDisplayDate !== today) {
                console.log('Date changed from', this.lastDisplayDate, 'to', today, '- refreshing heatmap');
                this.lastDisplayDate = today;
                this.updateStudyDisplay();
            }
        };
        
        // Check immediately
        checkDateChange();
        
        // Check every hour to catch date changes
        setInterval(checkDateChange, 60 * 60 * 1000);
        
        // Also check when the page becomes visible (user returns to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkDateChange();
            }
        });
    }
    
    setupEventListeners() {
        this.playBtn.addEventListener('click', this.startFunction);
        this.pauseBtn.addEventListener('click', () => this.handlePauseResume());
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.logBtn.addEventListener('click', () => this.toggleLog());
        
        // Add click event to timer display to switch modes (only when not running)
        this.timerDisplay.addEventListener('click', () => this.handleTimerModeClick());
        
        // Settings modal event listeners
        document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        this.timerModeSelect = document.getElementById('timerMode');
        this.timerModeSelect.addEventListener('change', () => this.onTimerModeChange());
        

        
        // Log filters event listeners
        document.getElementById('logTimeFilter').addEventListener('change', () => this.updateLogDisplay());
        document.getElementById('logSortBy').addEventListener('change', () => this.updateLogDisplay());
        
        // Edit session modal event listeners
        document.getElementById('closeEditSession').addEventListener('click', () => this.closeEditSessionModal());
        document.getElementById('saveEditSession').addEventListener('click', () => this.saveEditSession());
        
        // PWA install button event listener
        const installAppBtn = document.getElementById('installAppBtn');
        if (installAppBtn) {
            installAppBtn.addEventListener('click', () => this.installApp());
        }
        
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === document.getElementById('settingsModal')) {
                this.closeSettings();
            }

            if (event.target === document.getElementById('editSessionModal')) {
                this.closeEditSessionModal();
            }
        });
        
        // Add event delegation for log actions
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('edit-session-btn')) {
                const logEntry = event.target.closest('.log-entry');
                const index = parseInt(logEntry.dataset.sessionIndex);
                this.editSession(index);
            } else if (event.target.classList.contains('delete-session-btn')) {
                const logEntry = event.target.closest('.log-entry');
                const index = parseInt(logEntry.dataset.sessionIndex);
                this.deleteSession(index);
            }
        });
    }
    
    // Settings methods
    openSettings() {
        document.getElementById('settingsModal').style.display = 'flex';
        this.populateSettingsForm();
    }
    
    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }
    
    populateSettingsForm() {
        document.getElementById('timerMode').value = this.timerMode;
        
        // Populate focus time inputs
        const totalSeconds = this.focusMinutes * 60;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        document.getElementById('focusMinutes').value = minutes;
        document.getElementById('focusSeconds').value = seconds;
        
        this.updateFocusTimeVisibility();
    }
    
    onTimerModeChange() {
        this.updateFocusTimeVisibility();
        // Update progress bar visibility immediately
        if (this.progressBar) {
            if (document.getElementById('timerMode').value === 'stopwatch') {
                this.progressBar.style.display = 'none';
            } else {
                this.progressBar.style.display = 'block';
            }
        }
    }
    
    updateFocusTimeVisibility() {
        const mode = document.getElementById('timerMode').value;
        const focusTimeGroup = document.getElementById('focusTimeGroup');
        if (mode === 'stopwatch') {
            focusTimeGroup.style.display = 'none';
        } else {
            focusTimeGroup.style.display = 'block';
        }
    }
    
    saveSettings() {
        const mode = document.getElementById('timerMode').value;
        const focusMinutes = parseInt(document.getElementById('focusMinutes').value) || 0;
        const focusSeconds = parseInt(document.getElementById('focusSeconds').value) || 0;
        
        this.timerMode = mode;
        this.focusMinutes = focusMinutes + (focusSeconds / 60); // Convert to decimal minutes
        
        // Reset timer if mode changed or focus time changed
        if (mode === 'timer') {
            this.timeLeft = Math.round(this.focusMinutes * 60);
        } else {
            this.timeLeft = 0;
        }
        this.updateDisplay();
        
        // Save to localStorage
        localStorage.setItem('timerSettings', JSON.stringify({
            timerMode: this.timerMode,
            focusMinutes: this.focusMinutes
        }));
        
        this.closeSettings();
        console.log('Settings saved:', { mode, focusMinutes: this.focusMinutes });
    }
    
    loadSettings() {
        const saved = localStorage.getItem('timerSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.timerMode = settings.timerMode || 'timer';
                this.focusMinutes = settings.focusMinutes || 25;
                
                // Apply settings
                if (this.timerMode === 'timer') {
                    this.timeLeft = Math.round(this.focusMinutes * 60);
                } else {
                    this.timeLeft = 0;
                }
                this.updateDisplay();
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }
    

    
    initializeProgressBar() {
        // Hide progress bar by default - only show when timer is running
        if (this.progressBar) {
            this.progressBar.style.display = 'none';
        }
    }
    
    // Log functionality methods
    toggleLog() {
        if (this.logContainer.style.display === 'none') {
            this.showLog();
        } else {
            this.showHeatmap();
        }
    }
    
    showLog() {
        this.heatmapContainer.style.display = 'none';
        this.logContainer.style.display = 'block';
        
        // Set default time filter to "all time"
        document.getElementById('logTimeFilter').value = 'all';
        
        this.updateLogDisplay();
    }
    
    showHeatmap() {
        this.heatmapContainer.style.display = 'block';
        this.logContainer.style.display = 'none';
    }
    
    updateLogDisplay() {
        const logContent = document.getElementById('logContent');
        const timeFilter = document.getElementById('logTimeFilter').value;
        const sortBy = document.getElementById('logSortBy').value;
        
        if (this.studySessions.length === 0) {
            logContent.innerHTML = `
                <div class="empty-log">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="currentColor"/>
                    </svg>
                    <p>No study sessions yet</p>
                    <p style="font-size: 12px; color: #888;">Start a timer to begin tracking your study time</p>
                </div>
            `;
            return;
        }
        
        // Filter sessions based on time period
        let filteredSessions = [...this.studySessions];
        
        if (timeFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            filteredSessions = this.studySessions.filter(session => {
                const sessionDate = new Date(session.date);
                
                switch (timeFilter) {
                    case 'week':
                        const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
                        return sessionDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);
                        return sessionDate >= monthAgo;
                    case 'year':
                        const yearAgo = new Date(today.getFullYear(), 0, 1);
                        return sessionDate >= yearAgo;
                    default:
                        return true;
                }
            });
        }
        
        // Apply sorting to filtered sessions
        
        // Apply sorting
        filteredSessions.sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.date) - new Date(a.date);
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'duration-desc':
                    return b.seconds - a.seconds;
                case 'duration-asc':
                    return a.seconds - b.seconds;
                default:
                    return new Date(b.date) - new Date(a.date);
            }
        });
        
        // Generate log entries
        let html = '';
        filteredSessions.forEach((session, filteredIndex) => {
            // Find the actual index in the original studySessions array
            const actualIndex = this.studySessions.findIndex(s => s === session);
            
            const date = new Date(session.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            // Use the actual timestamp when the session was recorded
            const time = new Date(session.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true
            });
            
            // Show description if available
            const description = session.description ? `<div class="log-entry-description">${session.description}</div>` : '';
            const notes = session.notes ? `<div class="log-entry-notes">${session.notes}</div>` : '';
            const image = session.image ? `<div class="log-entry-image"><img src="${session.image}" alt="Session image" style="max-width: 100px; max-height: 60px; border-radius: 4px;"></div>` : '';
            
            html += `
                <div class="log-entry" data-session-index="${actualIndex}">
                    <div class="log-entry-info">
                        <div class="log-entry-date">${formattedDate}</div>
                        <div class="log-entry-time">Started at ${time}</div>
                        ${description}
                        ${notes}
                        ${image}
                    </div>
                    <div class="log-entry-actions">
                        <button class="edit-session-btn" title="Edit session">Edit</button>
                        <button class="delete-session-btn" title="Delete session">Delete</button>
                    </div>
                </div>
            `;
        });
        
        logContent.innerHTML = html;
        

    }
    
    editSession(index) {
        this.currentEditingIndex = index;
        const session = this.studySessions[index];
        
        // Populate the edit form
        document.getElementById('editSessionDate').value = session.date;
        document.getElementById('editSessionDescription').value = session.description || '';
        document.getElementById('editSessionImage').value = session.image || '';
        document.getElementById('editSessionNotes').value = session.notes || '';
        
        // Show the modal
        document.getElementById('editSessionModal').style.display = 'flex';
    }
    
    closeEditSessionModal() {
        document.getElementById('editSessionModal').style.display = 'none';
        this.currentEditingIndex = -1;
    }
    
    saveEditSession() {
        const newDate = document.getElementById('editSessionDate').value;
        const newDescription = document.getElementById('editSessionDescription').value.trim();
        const newImage = document.getElementById('editSessionImage').value.trim();
        const newNotes = document.getElementById('editSessionNotes').value.trim();
        
        if (this.currentEditingIndex === -1) {
            // This is a new session - update the latest session with the details
            if (this.studySessions.length > 0) {
                const latestSession = this.studySessions[this.studySessions.length - 1];
                latestSession.description = newDescription || undefined;
                latestSession.image = newImage || undefined;
                latestSession.notes = newNotes || undefined;
                
                // Update timestamp if date changed
                if (newDate !== latestSession.date) {
                    latestSession.date = newDate;
                    latestSession.timestamp = new Date(newDate + 'T00:00:00.000Z').toISOString();
                }
                
                console.log('New session details added:', latestSession);
            }
        } else {
            // This is editing an existing session
            const session = this.studySessions[this.currentEditingIndex];
            session.date = newDate;
            session.description = newDescription || undefined;
            session.image = newImage || undefined;
            session.notes = newNotes || undefined;
            
            // Update timestamp if date changed
            if (newDate !== session.date) {
                session.timestamp = new Date(newDate + 'T00:00:00.000Z').toISOString();
            }
            
            console.log('Session updated:', session);
        }
        
        // Save and update displays
        this.saveStudySessions();
        this.updateStudyDisplay();
        this.updateLogDisplay();
        
        // Reset modal title back to normal
        document.querySelector('#editSessionModal .modal-header h3').textContent = 'Edit Study Session';
        
        // Close modal
        this.closeEditSessionModal();
    }
    
    deleteSession(index) {
        if (confirm('Are you sure you want to delete this study session?')) {
            this.studySessions.splice(index, 1);
            this.saveStudySessions();
            this.updateStudyDisplay();
            this.updateLogDisplay();
            console.log('Session deleted');
        }
    }
    
    async loadStudySessions() {
        try {
            // Try to load from localStorage first
            const localData = localStorage.getItem('studyData');
            if (localData) {
                const data = JSON.parse(localData);
                this.studySessions = data.studySessions || [];
                console.log('Loaded saved sessions from localStorage:', this.studySessions);
            } else {
                // Fall back to JSON file if localStorage is empty
                const response = await fetch(this.dataFile);
                if (response.ok) {
                    const data = await response.json();
                    this.studySessions = data.studySessions || [];
                    console.log('Loaded saved sessions from JSON file:', this.studySessions);
                } else {
                    console.log('No JSON file found, starting with empty sessions');
                    this.studySessions = [];
                }
            }
        } catch (error) {
            console.log('Error loading study sessions:', error);
            this.studySessions = [];
        }
        this.updateStudyDisplay();
    }
    
    // Method to manually refresh the heatmap display
    refreshHeatmap() {
        console.log('Manual heatmap refresh triggered');
        console.log('Current sessions:', this.studySessions);
        this.updateStudyDisplay();
    }
    
    async saveStudySessions() {
        try {
            const data = {
                studySessions: this.studySessions,
                lastUpdated: new Date().toISOString()
            };
            
            // Save to localStorage only - this is more reliable and doesn't cause server errors
            localStorage.setItem('studyData', JSON.stringify(data));
            console.log('Study sessions saved to localStorage');
            
        } catch (error) {
            console.log('Error saving study sessions:', error);
        }
    }
    
    updateStudyDisplay() {
        console.log('Updating display with', this.studySessions.length, 'sessions');
        
        // Clean up old sessions outside the 365-day window
        this.cleanupOldSessions();
        
        if (this.studySessions.length === 0) {
            this.heatmapContainer.innerHTML = '<p style="color: #666; font-size: 14px; font-family: \'IBM Plex Mono\', monospace;">No study sessions yet. Start studying to track your progress!</p>';
            return;
        }
        
        // Create heatmap data for the last 365 days
        const heatmapData = this.createHeatmapData();
        
        console.log('Study sessions:', this.studySessions);
        console.log('Heatmap data:', heatmapData);
        console.log('Total days in heatmap:', Object.keys(heatmapData).length);
        
        // Get date range for display
        const dateKeys = Object.keys(heatmapData).sort();
        const startDate = dateKeys[0];
        const endDate = dateKeys[dateKeys.length - 1];
        
        // Log statistics to console
        const totalStudyTime = Object.values(heatmapData).reduce((sum, seconds) => sum + seconds, 0);
        const totalHours = Math.floor(totalStudyTime / 3600);
        const totalMinutes = Math.floor((totalStudyTime % 3600) / 60);
        const currentStreak = this.calculateCurrentStreak(heatmapData);
        const daysWithStudy = Object.values(heatmapData).filter(seconds => seconds > 0).length;
        const averageStudyTime = daysWithStudy > 0 ? Math.floor(totalStudyTime / daysWithStudy / 60) : 0;
        
        console.log('=== STUDY STATISTICS ===');
        console.log(`Date Range: ${startDate} to ${endDate} (${dateKeys.length} days)`);
        console.log(`Total Study Time: ${totalHours}h ${totalMinutes}m`);
        console.log(`Current Streak: ${currentStreak} days`);
        console.log(`Days Studied: ${daysWithStudy}/365 (${Math.round((daysWithStudy / 365) * 100)}%)`);
        console.log(`Average Study Time per Day: ${averageStudyTime}m`);
        console.log('========================');
        
        let html = '<div style="text-align: center; margin: 0 auto; display: flex; flex-direction: column; align-items: center;">';
        
        // Create heatmap data for the last 365 days
        html += '<div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">';
        
        // Add month labels at the top - positioned above the grid columns
        const monthLabels = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
        html += '<div style="display: flex; gap: 1px; margin-bottom: 8px; font-family: \'IBM Plex Mono\', monospace; font-size: 10px; color: #8b949e; margin-left: 38px;">';
        
        // Create month labels with more realistic spacing
        // Each month has roughly 4-5 weeks, so we'll adjust the spacing
        let currentWeek = 0;
        monthLabels.forEach((month, monthIndex) => {
            // More realistic month lengths (some months have 4 weeks, some have 5)
            const weeksInMonth = monthIndex === 0 ? 4 : (monthIndex % 2 === 0 ? 4 : 5); // Alternating pattern
            const monthWidth = weeksInMonth * 12; // 12px per week
            
            // Add month label
            html += `<div style="width: ${monthWidth}px; text-align: center; font-size: 10px;">${month}</div>`;
            currentWeek += weeksInMonth;
        });
        
        // Fill remaining weeks if needed - extend to cover exactly 365 days
        const weeksNeeded = Math.ceil(365 / 7);
        while (currentWeek < weeksNeeded) {
            html += '<div style="width: 12px; text-align: center; font-size: 10px;"></div>';
            currentWeek++;
        }
        html += '</div>';
        
        // Add day of week labels on the left - dynamically adjust based on today
        const today = new Date();
        const todayDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Create dynamic day order starting from today's day of the week
        const dynamicDays = [];
        for (let i = 0; i < 7; i++) {
            const dayIndex = (todayDayOfWeek + i) % 7;
            dynamicDays.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]);
        }
        
        console.log('Today is:', dynamicDays[0], 'Day order:', dynamicDays);
        
        // Create the main grid: 7 rows (days) x exactly 365 days
        const totalDays = Object.keys(heatmapData).length;
        const totalWeeks = Math.ceil(totalDays / 7);
        
        console.log('Grid creation - Total days:', totalDays, 'Total weeks needed:', totalWeeks);
        
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            html += '<div style="display: flex; gap: 1px; align-items: center;">';
            
            // Add day label on the left - use dynamic order
            html += `<div style="width: 30px; text-align: right; margin-right: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #8b949e;">${dynamicDays[dayIndex]}</div>`;
            
            // Add week columns for this day - only for the weeks we have data
            for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
                const dayOffset = weekIndex * 7 + dayIndex;
                const dateKey = Object.keys(heatmapData).sort()[dayOffset];
                
                if (dateKey) {
                    const totalSeconds = heatmapData[dateKey];
                    let color = '#161b22'; // No time studied (dark)
                    
                    // Light color gradient: more time = more white, all study sessions are clearly visible
                    if (totalSeconds > 0 && totalSeconds <= 300) color = '#6A6B6A';      // 0-5 minutes (light gray)
                    else if (totalSeconds > 300 && totalSeconds <= 600) color = '#818180';      // 5-10 minutes (lighter gray)
                    else if (totalSeconds > 600 && totalSeconds <= 1200) color = '#999999';      // 10-20 minutes
                    else if (totalSeconds > 1200 && totalSeconds <= 2400) color = '#B1B0B0';      // 20-40 minutes
                    else if (totalSeconds > 2400 && totalSeconds <= 3600) color = '#CBC8C9';      // 40-60 minutes
                    else if (totalSeconds > 3600 && totalSeconds <= 4800) color = '#DCDDDC';      // 60-80 minutes
                    else if (totalSeconds > 4800 && totalSeconds <= 6000) color = '#ECEDED';      // 80-100 minutes
                    else if (totalSeconds > 6000 && totalSeconds <= 7200) color = '#F3F3F2';      // 100-120 minutes
                    else if (totalSeconds > 7200 && totalSeconds <= 9000) color = '#F9F7F6';      // 120-150 minutes
                    else if (totalSeconds > 9000 && totalSeconds <= 10200) color = '#FDFDFD';      // 150-170 minutes
                    else if (totalSeconds > 10200 && totalSeconds <= 12000) color = '#FDFDFD';      // 170-200 minutes
                    else if (totalSeconds > 12000 && totalSeconds <= 15000) color = '#FDFDFD';      // 200-250 minutes
                    else if (totalSeconds > 15000 && totalSeconds <= 18000) color = '#ffffff';      // 250-300 minutes
                    else if (totalSeconds > 18000 && totalSeconds <= 21600) color = '#ffffff';      // 300-360 minutes (5-6 hours)
                    else if (totalSeconds > 21600 && totalSeconds <= 25200) color = '#ffffff';      // 360-420 minutes (6-7 hours)
                    else if (totalSeconds > 25200 && totalSeconds <= 28800) color = '#ffffff';      // 420-480 minutes (7-8 hours)
                    else if (totalSeconds > 28800 && totalSeconds <= 32400) color = '#ffffff';      // 480-540 minutes (8-9 hours)
                    else if (totalSeconds > 32400 && totalSeconds <= 36000) color = '#ffffff';      // 540-600 minutes (9-10 hours)
                    else if (totalSeconds > 36000) color = '#ffffff';                       // 600+ minutes (10+ hours - pure white)
                    
                    // Format display time
                    let displayTime;
                    if (totalSeconds < 60) {
                        displayTime = `${totalSeconds}s`;
                    } else if (totalSeconds < 3600) {
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = totalSeconds % 60;
                        if (seconds === 0) {
                            displayTime = `${minutes}m`;
                        } else {
                            displayTime = `${minutes}m ${seconds}s`;
                        }
                    } else {
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60); 
                        if (minutes === 0) {
                            displayTime = `${hours}h`;
                        } else {
                            displayTime = `${hours}h ${minutes}m`;
                        }
                    }
                    
                    // Format date for better display
                    const dateObj = new Date(dateKey);
                    const formattedDate = dateObj.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                    });
                    
                    // Check if this is today
                    const today = this.getCurrentDate();
                    const isToday = dateKey === today;
                    
                    // Add special styling for today
                    const todayStyle = isToday ? 'border: 2px solidrgba(255, 204, 0, 0.46); box-shadow: 0 0 5pxrgba(255, 204, 0, 0.52);' : '';
                    
                    // Add hack mode click functionality
                    const hackDataAttr = this.hackMode ? `data-hack-date="${dateKey}"` : '';
                    const hackCursor = this.hackMode ? 'cursor: pointer;' : 'cursor: pointer;';
                    
                    html += `<div style="width: 12px; height: 12px; background-color: ${color}; border-radius: 2px; border: 1px solid #30363d; ${hackCursor} ${todayStyle}; transition: all 0.2s ease;" onmouseover="this.style.transform='scale(1.3)'; this.style.zIndex='10';" onmouseout="this.style.transform='scale(1)'; this.style.zIndex='1';" title="${formattedDate}: ${displayTime} studied${isToday ? ' (Today)' : ''}${this.hackMode ? ' (Click to add time)' : ''}" ${hackDataAttr}></div>`;
                } else {
                    // Empty day (no date)
                    html += '<div style="width: 12px; height: 12px; background-color: transparent; border: 1px solid transparent;"></div>';
                }
            }
            
            html += '</div>'; // Close day row
        }
        
        html += '</div>'; // Close the main flex container
        
        // Add statistics below the heatmap
        const statsTotalStudyTime = Object.values(heatmapData).reduce((sum, seconds) => sum + seconds, 0);
        const statsTotalHours = Math.floor(statsTotalStudyTime / 3600);
        const statsTotalMinutes = Math.floor((statsTotalStudyTime % 3600) / 60);
        const totalSessions = this.studySessions.length;
        
        // Format total time display
        let timeDisplay;
        if (statsTotalHours > 0) {
            timeDisplay = statsTotalMinutes > 0 ? `${statsTotalHours}h ${statsTotalMinutes}m` : `${statsTotalHours}h`;
        } else {
            timeDisplay = `${statsTotalMinutes}m`;
        }
        
        html += `
            <div style="margin-top: 16px; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #666;">
                ${timeDisplay} total • ${totalSessions} sessions
            </div>
        `;
        
        this.heatmapContainer.innerHTML = html;
    }
    
    cleanupOldSessions() {
        const today = new Date();
        const cutoffDate = new Date(today);
        cutoffDate.setDate(today.getDate() - 365); // Remove sessions older than 365 days
        
        const cutoffDateString = cutoffDate.toISOString().split('T')[0];
        
        const initialCount = this.studySessions.length;
        this.studySessions = this.studySessions.filter(session => {
            return session.date >= cutoffDateString;
        });
        
        const removedCount = initialCount - this.studySessions.length;
        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} old study sessions older than ${cutoffDateString}`);
            // Save the cleaned data
            this.saveStudySessions();
        }
    }
    
    calculateCurrentStreak(heatmapData) {
        const dates = Object.keys(heatmapData).sort().reverse(); // Sort from newest to oldest
        let streak = 0;
        
        for (const date of dates) {
            if (heatmapData[date] > 0) {
                streak++;
            } else {
                break; // Break on first day with no study time
            }
        }
        
        return streak;
    }
    
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    createHeatmapData() {
        const heatmapData = {};
        const today = new Date();
        
        // Calculate start date as exactly 365 days ago from today
        // This ensures the first block shows exactly one year ago and includes today
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 364); // 364 days ago + today = 365 days total
        
        console.log('Today:', today.toISOString().split('T')[0]);
        console.log('Start date (365 days ago):', startDate.toISOString().split('T')[0]);
        
        // Create data for exactly 365 days from start date to today (inclusive)
        const currentDate = new Date(startDate);
        let dayCount = 0;
        
        while (dayCount < 365) {
            const dateKey = currentDate.toISOString().split('T')[0];
            heatmapData[dateKey] = 0;
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
        
        console.log('Created heatmap data for exactly', Object.keys(heatmapData).length, 'days');
        console.log('Date range:', Object.keys(heatmapData)[0], 'to', Object.keys(heatmapData)[Object.keys(heatmapData).length - 1]);
        
        // Fill in study session data
        console.log('Processing', this.studySessions.length, 'sessions for heatmap');
        console.log('Today\'s date:', this.getCurrentDate());
        console.log('Today\'s date in heatmap data:', heatmapData[this.getCurrentDate()]);
        
        this.studySessions.forEach(session => {
            console.log('Processing session:', session.date, 'with', session.seconds, 'seconds');
            if (heatmapData[session.date] !== undefined) {
                heatmapData[session.date] += session.seconds || 0;
                console.log('Added', session.seconds || 0, 'seconds for', session.date, 'Total now:', heatmapData[session.date]);
            } else {
                console.log('Session date not in current 365-day window:', session.date, 'Available dates:', Object.keys(heatmapData).slice(0, 5), '...');
            }
        });
        
        // Verify today is included
        const todayKey = this.getCurrentDate();
        console.log('Final check - Today\'s block should have data:', heatmapData[todayKey], 'seconds');
        
        // Ensure all values are numbers and handle any NaN values
        Object.keys(heatmapData).forEach(dateKey => {
            if (isNaN(heatmapData[dateKey])) {
                heatmapData[dateKey] = 0;
            }
        });
        
        return heatmapData;
    }
    
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.isPaused = false; // Reset paused state when starting
            this.startTime = new Date();
            
            // Ensure paused visual state is removed
            document.querySelector('.timer-controls').classList.remove('paused');
            
            console.log('Timer started at:', this.startTime);
            console.log('Switching button to STOP mode');
            
            // Add fullscreen class to container
            document.querySelector('.container').classList.add('fullscreen');
            
            // Replace play button with stop button
            this.playBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 6H18V18H6V6Z" fill="white"/>
                </svg>
            `;
            this.playBtn.removeEventListener('click', this.startFunction);
            this.playBtn.addEventListener('click', this.stopFunction);
            
            // Show progress bar when timer starts
            if (this.progressBar && this.timerMode === 'timer') {
                this.progressBar.style.display = 'block';
            }
            
            // Ensure pause button is set to pause mode
            this.pauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z" fill="white"/>
                </svg>
            `;
            
            // Start the timer/stopwatch
            this.interval = setInterval(() => {
                if (this.timerMode === 'timer') {
                    // Countdown timer
                    this.timeLeft--;
                    this.updateDisplay();
                    
                    if (this.timeLeft <= 0) {
                        this.handleStop();
                    }
                } else {
                    // Stopwatch
                    this.timeLeft++;
                    this.updateDisplay();
                }
            }, 1000);
            
            // Update display immediately to show the change
            this.updateDisplay();
        } else {
            console.log('Timer is already running, cannot start again');
        }
    }
    
    handleStop() {
        this.stop().catch(error => {
            console.error('Error stopping timer:', error);
        });
    }
    
    handlePauseResume() {
        this.pauseButtonClickCount++;
        console.log('=== handlePauseResume called (click #' + this.pauseButtonClickCount + ') ===');
        console.log('Current state: isRunning =', this.isRunning, 'isPaused =', this.isPaused);
        
        // Simple logic: if running, pause; if paused, resume
        if (this.isRunning) {
            console.log('🔄 Pausing timer...');
            this.pause();
        } else if (this.isPaused) {
            console.log('🔄 Resuming timer...');
            this.resume();
        } else {
            console.log('❌ Invalid state - cannot pause/resume');
            this.logTimerState();
        }
        
        console.log('After action - isRunning =', this.isRunning, 'isPaused =', this.isPaused);
        console.log('=== handlePauseResume end ===');
    }
    
    handleTimerModeClick() {
        // Use global check to prevent mode switching
        if (this.blockModeSwitching()) {
            this.toggleTimerMode();
        }
    }
    
    pause() {
        console.log('=== pause() called ===');
        console.log('Input state: isRunning =', this.isRunning, 'isPaused =', this.isPaused);
        
        if (this.isRunning) {
            this.isRunning = false;
            this.isPaused = true;
            clearInterval(this.interval);
            
            // Change pause button to resume button (play icon)
            this.pauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5V19L19 12L8 5Z" fill="white"/>
                </svg>
            `;
            
            // Add paused visual state
            document.querySelector('.timer-controls').classList.add('paused');
            
            console.log('✅ Timer paused successfully - button now shows play icon (▶️)');
            this.logTimerState();
        } else {
            console.log('❌ Cannot pause - timer is not running');
            this.logTimerState();
        }
        
        console.log('=== pause() end ===');
    }
    
    resume() {
        console.log('=== resume() called ===');
        console.log('Input state: isRunning =', this.isRunning, 'isPaused =', this.isPaused);
        
        if (this.isPaused) {
            this.isRunning = true;
            this.isPaused = false;
            
            // Change resume button back to pause button (pause icon)
            this.pauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z" fill="white"/>
                </svg>
            `;
            
            // Remove paused visual state
            document.querySelector('.timer-controls').classList.remove('paused');
            
            // Restart the timer
            this.interval = setInterval(() => {
                if (this.timerMode === 'timer') {
                    if (this.timeLeft > 0) {
                        this.timeLeft--;
                        this.updateDisplay();
                    } else {
                        this.stop();
                    }
                } else {
                    this.timeLeft++;
                    this.updateDisplay();
                }
            }, 1000);
            
            console.log('✅ Timer resumed successfully - button now shows pause icon (⏸️)');
            this.logTimerState();
        } else {
            console.log('❌ Cannot resume - timer is not paused');
            this.logTimerState();
        }
        
        console.log('=== resume() end ===');
    }
    
    async stop() {
        this.isRunning = false;
        this.isPaused = false; // Reset paused state when stopping
        clearInterval(this.interval);
        
        // Ensure paused visual state is removed
        document.querySelector('.timer-controls').classList.remove('paused');
        
        console.log('Timer stopped. Start time was:', this.startTime);
        console.log('Switching button back to START mode');
        
        // Remove fullscreen class from container
        document.querySelector('.container').classList.remove('fullscreen');
        
        // Hide progress bar when timer stops
        if (this.progressBar) {
            this.progressBar.style.display = 'none';
        }
        
        // Record study session if it was running
        if (this.startTime) {
            console.log('Recording study session...');
            await this.recordStudySession();
            
            // Automatically show edit session modal for the NEW session
            this.showEditSessionForNewSession();
        } else {
            console.log('No start time, not recording session');
        }
        
        // Reset timer based on mode
        if (this.timerMode === 'timer') {
            this.timeLeft = this.focusMinutes * 60;
        } else {
            this.timeLeft = 0;
        }
        this.updateDisplay();
        
        // Replace stop button with play button
        this.playBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5V19L19 12L8 5Z" fill="white"/>
            </svg>
        `;
        this.playBtn.removeEventListener('click', this.stopFunction);
        this.playBtn.addEventListener('click', this.startFunction);
        
        // Reset pause button to initial state
        this.pauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z" fill="white"/>
            </svg>
        `;
        
        this.startTime = null;
        console.log('Button reset complete, ready for next session');
    }
    
    // Debug method to check timer state
    logTimerState() {
        console.log('=== Timer State Debug ===');
        console.log('isRunning:', this.isRunning);
        console.log('isPaused:', this.isPaused);
        console.log('timeLeft:', this.timeLeft);
        console.log('timerMode:', this.timerMode);
        console.log('interval:', this.interval ? 'active' : 'null');
        console.log('========================');
    }
    
    // Global method to check if mode switching is allowed
    isModeSwitchingAllowed() {
        return !this.isRunning && !this.isPaused;
    }
    
    // Global method to block mode switching with visual feedback
    blockModeSwitching() {
        if (!this.isModeSwitchingAllowed()) {
            console.log('🚫 BLOCKED: Mode switching not allowed in current state');
            console.log('Current state: isRunning =', this.isRunning, 'isPaused =', this.isPaused);
            
            // Show visual feedback
            this.timerDisplay.style.opacity = '0.3';
            this.timerDisplay.style.color = '#ff6b6b';
            setTimeout(() => {
                this.timerDisplay.style.opacity = '1';
                this.timerDisplay.style.color = 'white';
            }, 1000);
            
            return false;
        }
        return true;
    }
    
    async recordStudySession() {
        const today = this.getCurrentDate();
        
        // Calculate exact minutes and seconds studied
        const endTime = new Date();
        const timeDiff = endTime - this.startTime;
        const totalSeconds = Math.floor(timeDiff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        // Store time in seconds for precise tracking
        const timeStudied = totalSeconds;
        
        // Always create a new session - don't combine with existing ones
        this.studySessions.push({
            date: today,
            timestamp: this.startTime.toISOString(), // Use the actual start time
            seconds: timeStudied,
            minutes: minutes,
            secondsRemainder: seconds,
            description: undefined,
            image: undefined,
            notes: undefined
        });
        console.log('New study session recorded for:', today, 'Time:', minutes + 'm ' + seconds + 's', 'Total seconds:', timeStudied);
        
        console.log('Total sessions:', this.studySessions.length);
        console.log('Total study time today:', this.studySessions.filter(s => s.date === today).reduce((sum, s) => sum + s.seconds, 0), 'seconds');
        
        // Save to localStorage
        await this.saveStudySessions();
        
        // Update display
        this.updateStudyDisplay();
        this.updateLogDisplay();
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update progress bar based on mode
        if (this.timerMode === 'timer' && this.isRunning) {
            this.progressBar.style.display = 'block';
            const totalTime = this.focusMinutes * 60;
            const progress = ((totalTime - this.timeLeft) / totalTime) * 100;
            this.progressBar.style.background = `linear-gradient(to right, #ffffff ${progress}%, #333 ${progress}%)`;
        } else {
            // For stopwatch or when not running, hide the progress bar
            this.progressBar.style.display = 'none';
        }
    }
    
    showEditSessionForNewSession() {
        // Get the most recent session (the one we just recorded)
        if (this.studySessions.length > 0) {
            const latestSession = this.studySessions[this.studySessions.length - 1];
            
            // Clear the form for a fresh new session
            document.getElementById('editSessionDate').value = latestSession.date;
            document.getElementById('editSessionDescription').value = '';
            document.getElementById('editSessionImage').value = '';
            document.getElementById('editSessionNotes').value = '';
            
            // Show the modal
            document.getElementById('editSessionModal').style.display = 'flex';
            
            // Change the modal title to indicate it's for a new session
            document.querySelector('#editSessionModal .modal-header h3').textContent = 'Session Completed! Add Details';
            
            // Set a special flag to indicate this is a new session, not an edit
            this.currentEditingIndex = -1; // -1 means new session
        }
    }
    
    toggleTimerMode() {
        // Use global check to prevent mode switching
        if (!this.blockModeSwitching()) {
            return;
        }
        
        if (this.timerMode === 'timer') {
            this.timerMode = 'stopwatch';
            this.timeLeft = 0;
            console.log('✅ Switched to stopwatch mode');
        } else {
            this.timerMode = 'timer';
            this.timeLeft = Math.round(this.focusMinutes * 60);
            console.log('✅ Switched to timer mode');
        }
        
        this.updateDisplay();
        this.initializeProgressBar();
        
        // Save the new mode to localStorage
        localStorage.setItem('timerSettings', JSON.stringify({
            timerMode: this.timerMode,
            focusMinutes: this.focusMinutes
        }));
    }
    
    setupTimerScrollEvents() {
        this.timerDisplay.addEventListener('wheel', (event) => {
            // Don't allow scrolling while running OR paused
            if (this.isRunning || this.isPaused) return;
            
            event.preventDefault();
            
            if (this.timerMode === 'timer') {
                // For timer mode, adjust the time
                const delta = event.deltaY > 0 ? -1 : 1; // Scroll down = decrease, scroll up = increase
                const currentMinutes = Math.floor(this.timeLeft / 60);
                const currentSeconds = this.timeLeft % 60;
                
                let newMinutes = currentMinutes;
                let newSeconds = currentSeconds;
                
                if (event.shiftKey) {
                    // Shift + scroll changes minutes
                    newMinutes = Math.max(0, Math.min(1440, currentMinutes + delta));
                } else {
                    // Regular scroll changes seconds
                    newSeconds = currentSeconds + delta;
                    if (newSeconds >= 60) {
                        newMinutes = Math.min(1440, currentMinutes + 1);
                        newSeconds = 0;
                    } else if (newSeconds < 0) {
                        if (currentMinutes > 0) {
                            newMinutes = currentMinutes - 1;
                            newSeconds = 59;
                        } else {
                            newSeconds = 0;
                        }
                    }
                }
                
                this.timeLeft = newMinutes * 60 + newSeconds;
                this.updateDisplay();
                
                // Update focus minutes for future sessions (convert to decimal format)
                this.focusMinutes = newMinutes + (newSeconds / 60);
                
                console.log(`Time adjusted: ${newMinutes}:${newSeconds.toString().padStart(2, '0')}`);
            } else {
                // For stopwatch mode, reset to 0
                this.timeLeft = 0;
                this.updateDisplay();
            }
        });
        
        // Add visual feedback that timer is clickable
        this.timerDisplay.style.cursor = 'pointer';
        this.timerDisplay.title = 'Click to switch between timer/stopwatch mode';
    }
    
    setupPWAInstall() {
        // Check if we're on localhost
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname === '0.0.0.0';
        
        if (isLocalhost) {
            console.log('🚫 PWA install disabled on localhost');
            // Show localhost notice
            const localhostNotice = document.getElementById('localhostNotice');
            if (localhostNotice) {
                localhostNotice.style.display = 'block';
            }
            return;
        }
        
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });
        
        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA was installed');
            this.deferredPrompt = null;
            this.hideInstallButton();
        });
    }
    
    setupKeyboardShortcuts() {
        // Global keyboard shortcuts for the app
        document.addEventListener('keydown', (event) => {
            // Don't trigger shortcuts when typing in input fields
            if (event.target.tagName === 'INPUT' || 
                event.target.tagName === 'TEXTAREA' || 
                event.target.tagName === 'SELECT') {
                return;
            }
            
            // Don't trigger shortcuts when modals are open (except for closing them)
            if (this.isModalOpen() && !this.isClosingShortcut(event)) {
                return;
            }
            
            const key = event.key.toLowerCase();
            
            switch (key) {
                case 'enter':
                case 's':
                    // Start timer (Enter or S)
                    if (!this.isRunning && !this.isPaused) {
                        event.preventDefault();
                        console.log('⌨️ Shortcut: Start timer (Enter/S)');
                        this.start();
                    }
                    break;
                    
                case 'p':
                    // Pause/Resume timer (P)
                    if (this.isRunning || this.isPaused) {
                        event.preventDefault();
                        console.log('⌨️ Shortcut: Pause/Resume timer (P)');
                        this.handlePauseResume();
                    }
                    break;
                    
                case 'f':
                    // Stop timer (F)
                    if (this.isRunning || this.isPaused) {
                        event.preventDefault();
                        console.log('⌨️ Shortcut: Stop timer (F)');
                        this.stop();
                    }
                    break;
                    
                case 'q':
                    // Open settings (Q)
                    event.preventDefault();
                    console.log('⌨️ Shortcut: Open settings (Q)');
                    this.openSettings();
                    break;
                    

                    
                case 'm':
                    // Toggle documents/log (M)
                    event.preventDefault();
                    console.log('⌨️ Shortcut: Toggle log (M)');
                    this.toggleLog();
                    break;
                    
                case 'escape':
                    // Close modals (Escape)
                    if (this.isModalOpen()) {
                        event.preventDefault();
                        console.log('⌨️ Shortcut: Close modals (Escape)');
                        this.closeAllModals();
                    }
                    break;
                    
                case 'h':
                    // Show help/shortcuts (H)
                    event.preventDefault();
                    console.log('⌨️ Shortcut: Show help (H)');
                    this.showShortcutsHelp();
                    break;
                    
                default:
                    // Check for hack mode activation
                    this.checkHackMode(key);
                    break;
            }
        });
        
        console.log('⌨️ Keyboard shortcuts enabled:');
        console.log('  Enter/S - Start timer');
        console.log('  P - Pause/Resume timer');
        console.log('  F - Stop timer');
        console.log('  Q - Open settings');

        console.log('  M - Toggle log/documents');
        console.log('  Escape - Close modals');
        console.log('  H - Show shortcuts help');
        
        // Test keyboard shortcuts on localhost
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.hostname === '0.0.0.0') {
            console.log('🔧 Localhost detected - testing shortcuts...');
            console.log('🎯 Try pressing: Enter, S, P, F, Q, M, Escape, H');
        }
    }
    
    isModalOpen() {
        const settingsModal = document.getElementById('settingsModal');
        const editSessionModal = document.getElementById('editSessionModal');
        const shortcutsHelpModal = document.getElementById('shortcutsHelpModal');
        
        return (settingsModal && settingsModal.style.display !== 'none') ||
               (editSessionModal && editSessionModal.style.display !== 'none') ||
               (shortcutsHelpModal && shortcutsHelpModal.style.display !== 'none');
    }
    
    isClosingShortcut(event) {
        return event.key === 'Escape';
    }
    
    closeAllModals() {
        this.closeSettings();
        this.closeEditSessionModal();
        this.closeShortcutsHelp();
    }
    

    
    showShortcutsHelp() {
        // Create shortcuts help modal
        const modal = document.createElement('div');
        modal.id = 'shortcutsHelpModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div class="modal-content shortcuts-help-content">
                <div class="modal-header">
                    <h3 style="margin: 0; font-family: 'IBM Plex Mono', monospace; color: white;">⌨️ Keyboard Shortcuts</h3>
                    <button class="shortcut-close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-grid">
                        <div class="shortcut-item">
                            <kbd>Enter</kbd> or <kbd>S</kbd>
                            <span>Start timer</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>P</kbd>
                            <span>Pause/Resume timer</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>F</kbd>
                            <span>Stop timer</span>
                            </div>
                        <div class="shortcut-item">
                            <kbd>Q</kbd>
                            <span>Open settings</span>
                        </div>

                        <div class="shortcut-item">
                            <kbd>M</kbd>
                            <span>Toggle log/documents</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Escape</kbd>
                            <span>Close modals</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>H</kbd>
                            <span>Show this help</span>
                        </div>
                    </div>

                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    closeShortcutsHelp() {
        const modal = document.getElementById('shortcutsHelpModal');
        if (modal) {
            modal.remove();
        }
    }
    
    showInstallButton() {
        const installGroup = document.getElementById('installAppGroup');
        if (installGroup) {
            installGroup.style.display = 'block';
        }
    }
    
    hideInstallButton() {
        const installGroup = document.getElementById('installAppGroup');
        if (installGroup) {
            installGroup.style.display = 'none';
        }
    }
    
    installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                this.deferredPrompt = null;
                this.hideInstallButton();
            });
        }
    }
    
    checkHackMode(key) {
        // Add the key to hack input
        this.hackInput += key;
        
        // Keep only last 2 characters
        if (this.hackInput.length > 2) {
            this.hackInput = this.hackInput.slice(-2);
        }
        
        // Check if "uy" is typed
        if (this.hackInput === 'uy') {
            this.activateHackMode();
        }
    }
    
    activateHackMode() {
        this.hackMode = true;
        this.hackInput = '';
        console.log('🔓 Hack mode activated');
        
        // Add visual indicator (subtle)
        document.body.style.border = '2px solid #ff6b6b';
        setTimeout(() => {
            document.body.style.border = 'none';
        }, 2000);
        
        // Regenerate heatmap with click handlers
        this.updateStudyDisplay();
        
        // Add event delegation for hack mode clicks
        this.setupHackModeClickHandler();
    }
    
    setupHackModeClickHandler() {
        // Remove any existing hack mode click handler
        if (this.hackModeClickHandler) {
            this.heatmapContainer.removeEventListener('click', this.hackModeClickHandler);
        }
        
        // Add new click handler
        this.hackModeClickHandler = (event) => {
            if (!this.hackMode) return;
            
            const target = event.target;
            const hackDate = target.getAttribute('data-hack-date');
            
            if (hackDate) {
                console.log('🔧 Heatmap block clicked for date:', hackDate);
                this.handleHackClick(hackDate);
            }
        };
        
        this.heatmapContainer.addEventListener('click', this.hackModeClickHandler);
        console.log('🔧 Hack mode click handler attached');
    }
    
    addHackSession(date, minutes) {
        if (!this.hackMode) return;
        
        const seconds = minutes * 60;
        
        // Check if session already exists for this date
        const existingSessionIndex = this.studySessions.findIndex(session => session.date === date);
        
        if (existingSessionIndex !== -1) {
            // Update existing session
            this.studySessions[existingSessionIndex].seconds += seconds;
            this.studySessions[existingSessionIndex].minutes = Math.floor(this.studySessions[existingSessionIndex].seconds / 60);
            this.studySessions[existingSessionIndex].secondsRemainder = this.studySessions[existingSessionIndex].seconds % 60;
        } else {
            // Create new session
            this.studySessions.push({
                date: date,
                timestamp: new Date(date + 'T12:00:00.000Z').toISOString(),
                seconds: seconds,
                minutes: minutes,
                secondsRemainder: 0,
                description: undefined,
                image: undefined,
                notes: undefined
            });
        }
        
        // Save and update display
        this.saveStudySessions();
        this.updateStudyDisplay();
        this.updateLogDisplay();
        
        console.log(`Added ${minutes} minutes to ${date}`);
    }
    
    handleHackClick(date) {
        console.log('🔧 handleHackClick called for date:', date);
        console.log('🔧 Hack mode active:', this.hackMode);
        
        if (!this.hackMode) {
            console.log('❌ Hack mode not active, ignoring click');
            return;
        }
        
        const minutes = prompt(`Add study time for ${date} (in minutes):`, '60');
        if (minutes !== null && !isNaN(minutes) && minutes > 0) {
            this.addHackSession(date, parseInt(minutes));
        }
    }
}

// Initialize the timer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.studyTimer = new StudyTimer();
});
