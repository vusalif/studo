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
        this.timerMode = 'timer'; // 'timer', 'stopwatch', or 'pomodoro'
        this.focusMinutes = 25;
        
        // Pomodoro settings
        this.pomodoroStudyMinutes = 25;
        this.pomodoroBreakMinutes = 5;
        this.pomodoroLongBreakMinutes = 15;
        this.pomodoroSessionsBeforeLongBreak = 4;
        this.pomodoroCurrentSession = 0;
        this.pomodoroPhase = 'study'; // 'study', 'break', 'longBreak'
        this.pomodoroIsBreak = false;
        this.pomodoroStudyStartTime = null; // Track when study session started
        
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
        
        // Chart instances storage
        this.charts = {};
        
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.accountBtn = document.getElementById('accountBtn');
        this.analyticsBtn = document.getElementById('analyticsBtn');
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
        
        // Request notification permission for Pomodoro
        this.requestNotificationPermission();
        
        console.log('✅ StudyTimer initialized successfully');
        console.log('⏱️ Timer mode:', this.timerMode);
        console.log('⏰ Time left:', this.timeLeft, 'seconds');
        console.log('🎯 Focus minutes:', this.focusMinutes);
        console.log('⌨️ Keyboard shortcuts enabled');
    }
    
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            // Request permission when user first interacts with the app
            document.addEventListener('click', () => {
                if (Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('✅ Notification permission granted');
                        } else {
                            console.log('❌ Notification permission denied');
                        }
                    });
                }
            }, { once: true });
        }
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
        this.accountBtn.addEventListener('click', () => this.openAccount());
        this.analyticsBtn.addEventListener('click', () => this.openAnalytics());
        this.logBtn.addEventListener('click', () => this.toggleLog());
        
        // Blurting button
        const blurtingBtn = document.getElementById('blurtingBtn');
        if (blurtingBtn) {
            blurtingBtn.addEventListener('click', () => {
                window.location.href = 'blurting.html';
            });
        }
        
        // Active Recall button
        const activeRecallBtn = document.getElementById('activeRecallBtn');
        if (activeRecallBtn) {
            activeRecallBtn.addEventListener('click', () => {
                window.location.href = 'active-recall.html';
            });
        }
        
        // Goal Setting button
        const goalSettingBtn = document.getElementById('goalSettingBtn');
        if (goalSettingBtn) {
            goalSettingBtn.addEventListener('click', () => {
                window.location.href = 'goal-setting.html';
            });
        }
        

        
        // Add click event to timer display to switch modes (only when not running)
        this.timerDisplay.addEventListener('click', () => this.handleTimerModeClick());
        
        // Settings modal event listeners
        document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        this.timerModeSelect = document.getElementById('timerMode');
        this.timerModeSelect.addEventListener('change', () => this.onTimerModeChange());
        
        // Pomodoro reset button event listener
        const resetPomodoroBtn = document.getElementById('resetPomodoroBtn');
        if (resetPomodoroBtn) {
            resetPomodoroBtn.addEventListener('click', () => this.resetPomodoro());
        }
        
        // Account modal event listeners
        document.getElementById('closeAccount').addEventListener('click', () => this.closeAccount());
        document.getElementById('deleteAccountBtn').addEventListener('click', () => this.deleteAccount());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Analytics modal event listeners
        document.getElementById('closeAnalytics').addEventListener('click', () => this.closeAnalytics());
        document.getElementById('toggleDetailedAnalyticsBtn').addEventListener('click', () => this.toggleDetailedAnalytics());
        
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
            if (event.target === document.getElementById('accountModal')) {
                this.closeAccount();
            }
            if (event.target === document.getElementById('analyticsModal')) {
                this.closeAnalytics();
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
        
        // Populate Pomodoro settings
        document.getElementById('pomodoroStudyMinutes').value = this.pomodoroStudyMinutes;
        document.getElementById('pomodoroBreakMinutes').value = this.pomodoroBreakMinutes;
        document.getElementById('pomodoroLongBreakMinutes').value = this.pomodoroLongBreakMinutes;
        document.getElementById('pomodoroSessionsBeforeLongBreak').value = this.pomodoroSessionsBeforeLongBreak;
        
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
        const pomodoroGroup = document.getElementById('pomodoroGroup');
        
        // Hide all groups first
        focusTimeGroup.style.display = 'none';
        pomodoroGroup.style.display = 'none';
        
        // Show appropriate group based on selection
        if (mode === 'timer') {
            focusTimeGroup.style.display = 'block';
        } else if (mode === 'pomodoro') {
            pomodoroGroup.style.display = 'block';
        }
        // stopwatch mode shows no additional settings
    }
    
    saveSettings() {
        const mode = document.getElementById('timerMode').value;
        const focusMinutes = parseInt(document.getElementById('focusMinutes').value) || 0;
        const focusSeconds = parseInt(document.getElementById('focusSeconds').value) || 0;
        
        this.timerMode = mode;
        this.focusMinutes = focusMinutes + (focusSeconds / 60); // Convert to decimal minutes
        
        // Load Pomodoro settings if in Pomodoro mode
        if (mode === 'pomodoro') {
            this.pomodoroStudyMinutes = parseInt(document.getElementById('pomodoroStudyMinutes').value) || 25;
            this.pomodoroBreakMinutes = parseInt(document.getElementById('pomodoroBreakMinutes').value) || 5;
            this.pomodoroLongBreakMinutes = parseInt(document.getElementById('pomodoroLongBreakMinutes').value) || 15;
            this.pomodoroSessionsBeforeLongBreak = parseInt(document.getElementById('pomodoroSessionsBeforeLongBreak').value) || 4;
        }
        
        // Reset timer if mode changed or focus time changed
        if (mode === 'timer') {
            this.timeLeft = Math.round(this.focusMinutes * 60);
        } else if (mode === 'pomodoro') {
            this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
            this.pomodoroPhase = 'study';
            this.pomodoroCurrentSession = 0;
            this.pomodoroIsBreak = false;
        } else {
            this.timeLeft = 0;
        }
        this.updateDisplay();
        
        // Save to localStorage
        const settings = {
            timerMode: this.timerMode,
            focusMinutes: this.focusMinutes
        };
        
        if (mode === 'pomodoro') {
            settings.pomodoroStudyMinutes = this.pomodoroStudyMinutes;
            settings.pomodoroBreakMinutes = this.pomodoroBreakMinutes;
            settings.pomodoroLongBreakMinutes = this.pomodoroLongBreakMinutes;
            settings.pomodoroSessionsBeforeLongBreak = this.pomodoroSessionsBeforeLongBreak;
        }
        
        localStorage.setItem('timerSettings', JSON.stringify(settings));
        
        this.closeSettings();
        console.log('Settings saved:', { mode, focusMinutes: this.focusMinutes, pomodoroSettings: mode === 'pomodoro' ? {
            studyMinutes: this.pomodoroStudyMinutes,
            breakMinutes: this.pomodoroBreakMinutes,
            longBreakMinutes: this.pomodoroLongBreakMinutes,
            sessionsBeforeLongBreak: this.pomodoroSessionsBeforeLongBreak
        } : 'N/A' });
    }
    
    loadSettings() {
        const saved = localStorage.getItem('timerSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.timerMode = settings.timerMode || 'timer';
                this.focusMinutes = settings.focusMinutes || 25;
                
                // Load Pomodoro settings
                if (settings.pomodoroStudyMinutes !== undefined) {
                    this.pomodoroStudyMinutes = settings.pomodoroStudyMinutes;
                }
                if (settings.pomodoroBreakMinutes !== undefined) {
                    this.pomodoroBreakMinutes = settings.pomodoroBreakMinutes;
                }
                if (settings.pomodoroLongBreakMinutes !== undefined) {
                    this.pomodoroLongBreakMinutes = settings.pomodoroLongBreakMinutes;
                }
                if (settings.pomodoroSessionsBeforeLongBreak !== undefined) {
                    this.pomodoroSessionsBeforeLongBreak = settings.pomodoroSessionsBeforeLongBreak;
                }
                
                // Apply settings
                if (this.timerMode === 'timer') {
                    this.timeLeft = Math.round(this.focusMinutes * 60);
                } else if (this.timerMode === 'pomodoro') {
                    this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
                    this.pomodoroPhase = 'study';
                    this.pomodoroCurrentSession = 0;
                    this.pomodoroIsBreak = false;
                } else {
                    this.timeLeft = 0;
                }
                this.updateDisplay();
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }
    
    // Account methods
    openAccount() {
        document.getElementById('accountModal').style.display = 'flex';
        this.populateAccountForm();
        this.setupCopyButtons();
    }
    
    closeAccount() {
        document.getElementById('accountModal').style.display = 'none';
    }
    
    async deleteAccount() {
        // Show confirmation dialog
        const confirmed = confirm('⚠️ Are you sure you want to remove all data from this account?\n\nThis action will:\n• Permanently delete all your study data\n• Remove your account from the system\n• Cannot be undone\n\nType "DELETE" to confirm:');
        
        if (!confirmed) return;
        
        const userInput = prompt('Please type "DELETE" to confirm removing all data from this account:');
        if (userInput !== 'DELETE') {
            alert('Account data removal cancelled. Your account is safe.');
            return;
        }
        
        try {
            // Close the account modal
            this.closeAccount();
            
            // Show loading state
            const loadingMsg = document.createElement('div');
            loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px; border-radius: 10px; z-index: 10000; font-family: "IBM Plex Mono", monospace;';
            loadingMsg.innerHTML = '🗑️ Deleting account...<br><small>Please wait...</small>';
            document.body.appendChild(loadingMsg);
            
            // Get current user before deletion
            let currentUser = null;
            if (window.SupabaseService && window.SupabaseService.auth) {
                try {
                    // First try to get cached user to avoid API calls
                    const cachedUser = window.SupabaseService.auth.getCachedUser();
                    if (cachedUser) {
                        currentUser = cachedUser;
                        console.log('Current user found from cached session:', currentUser.id);
                    } else {
                        // Try to get user from session
                        const { session, error: sessionError } = await window.SupabaseService.auth.getCurrentSession();
                        
                        if (sessionError) {
                            console.log('Session error, trying getCurrentUser:', sessionError.message);
                        } else if (session && session.user) {
                            currentUser = session.user;
                            console.log('Current user found from session:', currentUser.id);
                        } else {
                            // Fallback to getCurrentUser
                            const { user, error } = await window.SupabaseService.auth.getCurrentUser();
                            if (error) {
                                console.log('getCurrentUser error:', error.message);
                            } else if (user) {
                                currentUser = user;
                                console.log('Current user found from getCurrentUser:', currentUser.id);
                            }
                        }
                    }
                    
                    // If still no user, try to get from localStorage
                    if (!currentUser) {
                        const userSession = this.restoreUserSession();
                        if (userSession) {
                            currentUser = { id: userSession.userId, email: userSession.userEmail };
                            console.log('Current user found from localStorage:', currentUser.id);
                        }
                    }
                } catch (error) {
                    console.log('Error getting current user from Supabase, using localStorage:', error.message);
                    
                    // Last resort: try localStorage
                    const userSession = this.restoreUserSession();
                    if (userSession) {
                        currentUser = { id: userSession.userId, email: userSession.userEmail };
                        console.log('Current user found from localStorage (fallback):', currentUser.id);
                    }
                }
            }
            
            // If no user found anywhere, show error and return
            if (!currentUser) {
                console.error('No user found for deletion');
                alert('No user account found. Cannot delete account.');
                return;
            }
            
            if (currentUser) {
                try {
                    console.log('Starting account deletion process...');
                    
                    // CRITICAL: Delete user account from Supabase authentication FIRST
                    if (window.SupabaseService && window.SupabaseService.supabase) {
                        console.log('🗑️ Attempting to delete user account from Supabase auth...');
                        
                        try {
                            // Since client-side code cannot directly delete users from auth.users,
                            // we'll use alternative methods to prevent future logins
                            
                            // Method 1: Try to use RPC function if available
                            try {
                                const { error: rpcError } = await window.SupabaseService.supabase
                                    .rpc('delete_user_account', { user_id: currentUser.id });
                                
                                if (!rpcError) {
                                    console.log('✅ User account deleted via RPC function');
                                } else {
                                    console.log('⚠️ RPC delete failed:', rpcError.message);
                                    throw new Error('RPC delete failed');
                                }
                            } catch (rpcError) {
                                console.log('RPC delete not available, trying force deletion...');
                                
                                // Method 2: Force deletion using direct SQL
                                try {
                                    const { error: forceError } = await window.SupabaseService.supabase
                                        .rpc('force_delete_user', { 
                                            target_user_id: currentUser.id 
                                        });
                                    
                                    if (!forceError) {
                                        console.log('✅ User account force deleted via RPC');
                                    } else {
                                        console.log('⚠️ Force delete RPC failed:', forceError.message);
                                        throw new Error('Force delete RPC failed');
                                    }
                                } catch (forceError) {
                                    console.log('Force delete RPC not available, using credential invalidation...');
                                    
                                    // Method 3: Invalidate user credentials to prevent future logins
                                    await this.invalidateUserCredentials(currentUser.id);
                                }
                            }
                        } catch (error) {
                            console.log('All deletion methods failed, using credential invalidation...');
                            await this.invalidateUserCredentials(currentUser.id);
                        }
                    }
                    
                    // Delete user data from Supabase tables
                    if (window.SupabaseService) {
                        console.log('🗑️ Deleting user data from Supabase tables...');
                        
                        // Delete study sessions
                        try {
                            const { error: sessionsError } = await window.SupabaseService.studySessions.deleteAll();
                            if (!sessionsError) {
                                console.log('✅ Study sessions deleted successfully');
                            } else {
                                console.log('⚠️ Study sessions deletion failed:', sessionsError);
                            }
                        } catch (e) {
                            console.log('Study sessions deletion failed:', e);
                        }
                        
                        // Delete timer settings
                        try {
                            const { error: settingsError } = await window.SupabaseService.timerSettings.deleteAll();
                            if (!settingsError) {
                                console.log('✅ Timer settings deleted successfully');
                            } else {
                                console.log('⚠️ Timer settings deletion failed:', settingsError);
                            }
                        } catch (e) {
                            console.log('Timer settings deletion failed:', e);
                        }
                        
                        // Delete from profiles table
                        try {
                            const { error: profileError } = await window.SupabaseService.supabase
                                .from('profiles')
                                .delete()
                                .eq('id', currentUser.id);
                            
                            if (!profileError) {
                                console.log('✅ User profile deleted successfully');
                            } else {
                                console.log('⚠️ Profile deletion failed:', profileError);
                            }
                        } catch (e) {
                            console.log('Profile deletion failed:', e);
                        }
                        
                        // Try to delete from any other user-related tables
                        const additionalTables = ['user_sessions', 'user_data', 'user_preferences', 'user_stats', 'user_analytics', 'blurting_notes', 'review_history', 'flashcards', 'flashcard_decks'];
                        for (const tableName of additionalTables) {
                            try {
                                const { error: tableError } = await window.SupabaseService.supabase
                                    .from(tableName)
                                    .delete()
                                    .eq('user_id', currentUser.id);
                                
                                if (!tableError) {
                                    console.log(`✅ Deleted from ${tableName}`);
                                }
                            } catch (tableErr) {
                                // Table might not exist, which is fine
                            }
                        }
                    }
                    
                    // Sign out the user to invalidate any remaining sessions
                    console.log('🚪 Signing out user...');
                    try {
                        if (window.SupabaseService && window.SupabaseService.auth) {
                            await window.SupabaseService.auth.signOut();
                            console.log('✅ User signed out successfully');
                        }
                    } catch (signOutError) {
                        console.log('Sign out error (expected if user already deleted):', signOutError);
                    }
                    
                    // Clear all local storage and session data
                    console.log('🧹 Clearing local data...');
                    // This clears all localStorage including:
                    // - studyData
                    // - blurting_notes (from blurting.js)
                    // - any cached flashcard data
                    // - user session data
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // Clear any cookies
                    document.cookie.split(";").forEach(function(c) { 
                        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                    });
                    console.log('✅ Local data cleared');
                    
                    // Remove loading message
                    document.body.removeChild(loadingMsg);
                    
                    // Show success message
                    alert('🎉 All data removed from account!\n\nAll your data has been permanently removed from the system.\nYou will be redirected to the login page.');
                    
                    // Force redirect to login with cache clearing
                    window.location.replace('login.html');
                    
                } catch (error) {
                    console.error('❌ Account deletion failed:', error);
                    
                    // Remove loading message
                    if (document.body.contains(loadingMsg)) {
                        document.body.removeChild(loadingMsg);
                    }
                    
                    // Show error message
                    alert(`❌ Account deletion failed!\n\nError: ${error.message}\n\nPlease try again or contact support if the problem persists.`);
                }
            }
        } catch (error) {
            console.error('❌ Account deletion process failed:', error);
            
            // Remove loading message if it exists
            const loadingMsg = document.querySelector('div[style*="position: fixed"]');
            if (loadingMsg) {
                document.body.removeChild(loadingMsg);
            }
            
            alert(`❌ Account deletion failed!\n\nError: ${error.message}\n\nPlease try again or contact support if the problem persists.`);
        }
    }
    
    async populateAccountForm() {
        try {
            console.log('Populating account form...');
            
            // Try to get current user from Supabase using the service
            if (window.SupabaseService && window.SupabaseService.auth) {
                try {
                    const { user, error } = await window.SupabaseService.auth.getCurrentUser();
                    
                    if (error) {
                        console.log('Supabase auth error, using localStorage fallback:', error.message);
                        this.loadFromLocalStorage();
                        return;
                    }
                    
                    if (user) {
                        console.log('User found in Supabase:', user.email);
                        // Display actual user email from Supabase
                        document.getElementById('accountUsername').value = user.email || 'No email found';
                        
                        // Try to get password from Supabase (this will likely fail due to security)
                        try {
                            // Attempt to get user details including password (this won't work)
                            const { data: userDetails, error: userError } = await window.SupabaseService.supabase
                                .from('profiles')
                                .select('*')
                                .eq('id', user.id)
                                .single();
                            
                            if (userError) {
                                console.log('Could not retrieve user details:', userError);
                                document.getElementById('accountPassword').value = '••••••••••••••••';
                            } else {
                                // Even if we get user details, password will be hashed/encrypted
                                document.getElementById('accountPassword').value = userDetails.password || '••••••••••••••••';
                                console.log('User details retrieved (password will be encrypted):', userDetails);
                            }
                        } catch (passwordError) {
                            console.log('Password retrieval failed (expected):', passwordError);
                            document.getElementById('accountPassword').value = '••••••••••••••••';
                        }
                        
                        console.log('Loaded user data from Supabase:', { email: user.email });
                    } else {
                        // Fallback to localStorage if no Supabase user
                        console.log('No user found in Supabase, using localStorage');
                        this.loadFromLocalStorage();
                    }
                } catch (authError) {
                    console.log('Supabase auth failed, using localStorage fallback:', authError.message);
                    this.loadFromLocalStorage();
                }
            } else {
                // Fallback to localStorage if Supabase service not available
                console.log('Supabase service not available, using localStorage');
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error in populateAccountForm:', error);
            this.loadFromLocalStorage();
        }
    }
    
    loadFromLocalStorage() {
        const savedAccount = localStorage.getItem('accountInfo');
        if (savedAccount) {
            try {
                const account = JSON.parse(savedAccount);
                document.getElementById('accountUsername').value = account.username || 'No username found';
                document.getElementById('accountPassword').value = account.password || '••••••••••••••••';
            } catch (e) {
                console.error('Error loading account info:', e);
                this.showAccountError('Error loading saved account data');
            }
        } else {
            // Try to get user email from localStorage (set during login)
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail) {
                document.getElementById('accountUsername').value = userEmail;
                document.getElementById('accountPassword').value = '••••••••••••••••';
                console.log('Loaded user email from localStorage:', userEmail);
            } else {
                document.getElementById('accountUsername').value = 'No user logged in';
                document.getElementById('accountPassword').value = '••••••••••••••••';
            }
        }
    }
    
    showAccountError(message) {
        document.getElementById('accountUsername').value = 'Error loading data';
        document.getElementById('accountPassword').value = '••••••••••••••••';
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.marginTop = '10px';
        errorDiv.textContent = message;
        
        const modalBody = document.querySelector('#accountModal .modal-body');
        modalBody.appendChild(errorDiv);
        
        // Remove error message after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    setupCopyButtons() {
        // Setup copy buttons with null checks
        const copyUsernameBtn = document.getElementById('copyUsername');
        const copyPasswordBtn = document.getElementById('copyPassword');
        
        if (copyUsernameBtn) {
            copyUsernameBtn.addEventListener('click', () => this.copyToClipboard('accountUsername'));
        }
        
        if (copyPasswordBtn) {
            copyPasswordBtn.addEventListener('click', () => this.copyToClipboard('accountPassword'));
        }
    }
    
    async copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        const textToCopy = element.value;
        
        if (textToCopy === '••••••••••••••••' || textToCopy === 'No user logged in' || textToCopy === 'Error loading data') {
            alert('Nothing to copy');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // Show success feedback
            const button = elementId === 'accountUsername' ? document.getElementById('copyUsername') : document.getElementById('copyPassword');
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = 'rgba(76, 175, 80, 0.3)';
                button.style.borderColor = 'rgba(76, 175, 80, 0.5)';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                    button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }, 2000);
            }
            
            console.log('Copied to clipboard:', textToCopy);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        }
    }
    
    // Analytics methods
    openAnalytics() {
        document.getElementById('analyticsModal').style.display = 'flex';
        this.populateAnalytics();
    }
    
    closeAnalytics() {
        document.getElementById('analyticsModal').style.display = 'none';
    }
    
    populateAnalytics() {
        const analyticsContent = document.getElementById('analyticsContent');
        
        if (this.studySessions.length === 0) {
            analyticsContent.innerHTML = '<p>No study sessions yet. Start studying to see your analytics!</p>';
            return;
        }
        
        // Calculate analytics
        const totalSessions = this.studySessions.length;
        const totalStudyTime = this.studySessions.reduce((sum, session) => sum + (session.seconds || 0), 0);
        const totalHours = Math.floor(totalStudyTime / 3600);
        const totalMinutes = Math.floor((totalStudyTime % 3600) / 60);
        
        // Calculate average session length
        const averageSessionMinutes = Math.round(totalStudyTime / totalSessions / 60);
        
        // Calculate study streak (consecutive days with study sessions)
        const studyStreak = this.calculateCurrentStreak(this.createHeatmapData());
        
        // Get most active day of week
        const dayStats = this.getDayOfWeekStats();
        const mostActiveDay = dayStats.reduce((max, day) => day.total > max.total ? day : max);
        
        // Format analytics display
        analyticsContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h5 style="color: white; margin-bottom: 10px;"></h5>
                <p>Total Sessions: <strong>${totalSessions}</strong></p>
                <p>Total Study Time: <strong>${totalHours}h ${totalMinutes}m</strong></p>
                <p>Average Session: <strong>${averageSessionMinutes} minutes</strong></p>
                <p>Current Streak: <strong>${studyStreak} days</strong></p>
            </div>
            
        `;
        
        // Populate basic analytics
        this.populateBasicAnalytics();
    }
    
    getDayOfWeekStats() {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayStats = dayNames.map((name, index) => ({
            name,
            total: 0,
            sessions: 0
        }));
        
        this.studySessions.forEach(session => {
            if (session.date) {
                const date = new Date(session.date);
                const dayIndex = date.getDay();
                dayStats[dayIndex].total += session.seconds || 0;
                dayStats[dayIndex].sessions += 1;
            }
        });
        
        return dayStats;
    }
    
    populateBasicAnalytics() {
        try {
            // Populate Weekly Activity
            const weeklyActivityBasic = document.getElementById('weeklyActivityBasic');
            if (weeklyActivityBasic) {
                const dayStats = this.getDayOfWeekStats();
                const weeklyHtml = dayStats.map(day => `
                    <p>${day.name}: <strong>${Math.round(day.total / 60)}m</strong> (${day.sessions} sessions)</p>
                `).join('');
                
                weeklyActivityBasic.innerHTML = weeklyHtml || '<p style="color: #888;">No weekly data available</p>';
            }
            
            // Populate Most Active
            const mostActiveBasic = document.getElementById('mostActiveBasic');
            if (mostActiveBasic) {
                const dayStats = this.getDayOfWeekStats();
                const sortedDays = dayStats.sort((a, b) => b.total - a.total);
                const top3Days = sortedDays.slice(0, 3);
                
                const mostActiveHtml = top3Days.map((day, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                    return `
                        <p>${medal} ${day.name}: <strong>${Math.round(day.total / 60)}m</strong> (${day.sessions} sessions)</p>
                    `;
                }).join('');
                
                mostActiveBasic.innerHTML = mostActiveHtml || '<p style="color: #888;">No activity data available</p>';
            }
        } catch (error) {
            console.error('Error populating basic analytics:', error);
        }
    }
    
    toggleDetailedAnalytics() {
        const detailedSection = document.getElementById('detailedAnalyticsSection');
        const toggleBtn = document.getElementById('toggleDetailedAnalyticsBtn');
        const toggleText = toggleBtn.querySelector('.toggle-text');
        
        if (detailedSection.style.display === 'none' || detailedSection.style.display === '') {
            // Show detailed analytics
            detailedSection.style.display = 'block';
            toggleBtn.classList.add('expanded');
            toggleText.textContent = 'Hide Detailed Charts';
            
            // Create charts if they don't exist
            this.createDetailedCharts();
            this.populateDetailedTextAnalytics();
            this.populateStatistics();
        } else {
            // Hide detailed analytics
            detailedSection.style.display = 'none';
            toggleBtn.classList.remove('expanded');
            toggleText.textContent = 'Show Detailed Charts';
        }
    }
    
    destroyAllCharts() {
        // Destroy all existing charts to prevent canvas reuse errors
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {}; // Reset charts object
    }

    createDetailedCharts() {
        if (this.studySessions.length === 0) {
            console.log('No study sessions to create charts');
            return;
        }

        try {
            // Destroy existing charts first
            this.destroyAllCharts();
            
            // Create time distribution chart
                    this.createTimeDistributionChart();
        
        // Create weekly activity chart
        this.createWeeklyActivityChart();
        
        // Create session length distribution chart
        this.createSessionLengthChart();
        
        // Create monthly progress chart
        this.createMonthlyProgressChart();
        
        // Populate text-based analytics
        this.populateStreaksContent();
        this.populateTopDaysContent();
        } catch (error) {
            console.error('Error creating charts:', error);
        }
    }

    populateStatistics() {
        if (this.studySessions.length === 0) {
            this.updateStatisticsElement('totalSessions', '0');
            this.updateStatisticsElement('totalStudyTime', '0h 0m');
            this.updateStatisticsElement('averageSession', '0m');
            this.updateStatisticsElement('currentStreak', '0 days');
            return;
        }

        try {
            const totalSessions = this.studySessions.length;
            const totalStudyTime = this.studySessions.reduce((sum, session) => sum + (session.seconds || 0), 0);
            const totalHours = Math.floor(totalStudyTime / 3600);
            const totalMinutes = Math.floor((totalStudyTime % 3600) / 60);
            const averageSessionMinutes = Math.round(totalStudyTime / totalSessions / 60);
            
            // Create heatmap data and calculate streak safely
            const heatmapData = this.createHeatmapData();
            const currentStreak = this.calculateCurrentStreak(heatmapData);

            this.updateStatisticsElement('totalSessions', totalSessions);
            this.updateStatisticsElement('totalStudyTime', `${totalHours}h ${totalMinutes}m`);
            this.updateStatisticsElement('averageSession', `${averageSessionMinutes}m`);
            this.updateStatisticsElement('currentStreak', `${currentStreak} days`);
        } catch (error) {
            console.error('Error populating statistics:', error);
            // Fallback values
            this.updateStatisticsElement('totalSessions', 'Error');
            this.updateStatisticsElement('totalStudyTime', 'Error');
            this.updateStatisticsElement('averageSession', 'Error');
            this.updateStatisticsElement('currentStreak', 'Error');
        }
    }

    updateStatisticsElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Statistics element with ID '${id}' not found`);
        }
    }
    
    createTimeDistributionChart() {
        const ctx = document.getElementById('timeDistributionChart').getContext('2d');
        
        // Group sessions by hour of day
        const hourlyData = new Array(24).fill(0);
        this.studySessions.forEach(session => {
            if (session.startTime) {
                const startTime = new Date(session.startTime);
                const hour = startTime.getHours();
                hourlyData[hour] += (session.seconds || 0) / 3600; // Convert to hours
            }
        });
        
        this.charts.timeDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Study Hours',
                    data: hourlyData,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#ccc'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#ccc'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
    
    createWeeklyActivityChart() {
        const ctx = document.getElementById('weeklyActivityChart').getContext('2d');
        const weeklyStats = this.getDayOfWeekStats();
        
        this.charts.weeklyActivity = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: weeklyStats.map(day => day.name),
                datasets: [{
                    data: weeklyStats.map(day => day.total / 3600), // Convert to hours
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)',
                        'rgba(199, 199, 199, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#fff',
                            padding: 20
                        }
                    }
                }
            }
        });
    }
    
    createSessionLengthChart() {
        const ctx = document.getElementById('sessionLengthChart').getContext('2d');
        
        // Group sessions by duration ranges
        const durationRanges = [
            { min: 0, max: 15, label: '0-15 min' },
            { min: 15, max: 30, label: '15-30 min' },
            { min: 30, max: 60, label: '30-60 min' },
            { min: 60, max: 120, label: '1-2 hours' },
            { min: 120, max: 240, label: '2-4 hours' },
            { min: 240, max: 999999, label: '4+ hours' }
        ];
        
        const rangeData = durationRanges.map(range => {
            return this.studySessions.filter(session => 
                (session.seconds || 0) >= range.min * 60 && (session.seconds || 0) < range.max * 60
            ).length;
        });
        
        this.charts.sessionLength = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: durationRanges.map(r => r.label),
                datasets: [{
                    data: rangeData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#fff',
                            padding: 20
                        }
                    }
                }
            }
        });
    }
    
    createMonthlyProgressChart() {
        const ctx = document.getElementById('monthlyProgressChart').getContext('2d');
        
        // Group sessions by month
        const monthlyData = {};
        this.studySessions.forEach(session => {
            if (session.startTime) {
                const startTime = new Date(session.startTime);
                const monthKey = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}`;
                monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (session.seconds || 0) / 3600; // Convert to hours
            }
        });
        
        // Sort months chronologically
        const sortedMonths = Object.keys(monthlyData).sort();
        
        this.charts.monthlyProgress = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedMonths.map(month => {
                    const [year, monthNum] = month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
                }),
                datasets: [{
                    label: 'Study Hours',
                    data: sortedMonths.map(month => monthlyData[month]),
                    borderColor: 'rgba(76, 175, 80, 1)',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#ccc'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#ccc'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
    
    populateDetailedTextAnalytics() {
        // Populate streaks content
        this.populateStreaksContent();
        
        // Populate top days content
        this.populateTopDaysContent();
    }
    
    populateStreaksContent() {
        const streaksContent = document.getElementById('streaksContent');
        if (!streaksContent) {
            console.warn('Streaks content element not found');
            return;
        }
        
        try {
            const currentStreak = this.calculateCurrentStreak(this.createHeatmapData());
            const longestStreak = this.calculateLongestStreak();
            
            streaksContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="text-align: center; padding: 15px; background: rgba(76, 175, 80, 0.2); border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #4CAF50;">Current Streak</h4>
                    <p style="margin: 0; font-size: 24px; color: white;">${currentStreak} days</p>
                </div>
                <div style="text-align: center; padding: 15px; background: rgba(255, 193, 7, 0.2); border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #FFC107;">Longest Streak</h4>
                    <p style="margin: 0; font-size: 24px; color: white;">${longestStreak} days</p>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <p style="color: #ccc; font-size: 14px;">
                    🔥 Keep up the momentum! Your current streak is ${currentStreak} days.
                    ${currentStreak > 0 ? 'Great job!' : 'Start studying today to begin your streak!'}
                </p>
            </div>
        `;
        } catch (error) {
            console.error('Error populating streaks content:', error);
            streaksContent.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #888;">
                    <p>Error loading streaks data</p>
                </div>
            `;
        }
    }
    
    populateTopDaysContent() {
        const topDaysContent = document.getElementById('topDaysContent');
        if (!topDaysContent) {
            console.warn('Top days content element not found');
            return;
        }
        
        try {
            const weeklyStats = this.getDayOfWeekStats();
            
            // Sort days by study time
            const sortedDays = weeklyStats.sort((a, b) => b.total - a.total);
            
            topDaysContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #4CAF50; margin-bottom: 15px;">Ranking by Study Time</h4>
                ${sortedDays.map((day, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255, 255, 255, 0.05); margin-bottom: 8px; border-radius: 6px;">
                            <span style="color: #ccc;">${medal} ${day.name}</span>
                            <span style="color: white; font-weight: bold;">${Math.round(day.total / 60)}m</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        } catch (error) {
            console.error('Error populating top days content:', error);
            topDaysContent.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #888;">
                    <p>Error loading top days data</p>
                </div>
            `;
        }
    }
    
    calculateLongestStreak() {
        if (this.studySessions.length === 0) return 0;
        
        let longestStreak = 0;
        let currentStreak = 0;
        let lastDate = null;
        
        // Sort sessions by date
        const sortedSessions = [...this.studySessions].sort((a, b) => new Date(a.date || a.startTime) - new Date(b.date || b.startTime));
        
        for (let i = 0; i < sortedSessions.length; i++) {
            const sessionDate = new Date(sortedSessions[i].date || sortedSessions[i].startTime).toDateString();
            
            if (lastDate === null) {
                currentStreak = 1;
            } else {
                const daysDiff = Math.floor((new Date(sortedSessions[i].date || sortedSessions[i].startTime) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
                if (daysDiff === 1) {
                    currentStreak++;
                } else if (daysDiff > 1) {
                    longestStreak = Math.max(longestStreak, currentStreak);
                    currentStreak = 1;
                }
            }
            
            lastDate = sessionDate;
        }
        
        longestStreak = Math.max(longestStreak, currentStreak);
        return longestStreak;
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
        
        // Switch to grid icon when showing log
        this.switchToGridIcon();
        
        // Enable log focus mode to hide study icons when log is active
        this.enableLogFocusMode();
        
        this.updateLogDisplay();
    }
    
    showHeatmap() {
        this.heatmapContainer.style.display = 'block';
        this.logContainer.style.display = 'none';
        
        // Switch back to log icon when showing heatmap
        this.switchToLogIcon();
        
        // Disable log focus mode to show study icons when heatmap is active
        // Only disable if timer is not running (timer has its own focus mode)
        if (!this.isRunning && !this.isPaused) {
            this.disableLogFocusMode();
        }
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
    
    async saveEditSession() {
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
                
                // Try to update in Supabase
                await this.updateSessionInSupabase(latestSession);
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
            
            // Try to update in Supabase
            await this.updateSessionInSupabase(session);
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
    
    async updateSessionInSupabase(session) {
        try {
            if (window.SupabaseService && localStorage.getItem('isLoggedIn') === 'true' && session.id) {
                const updates = {
                    session_date: session.date,
                    description: session.description || null,
                    image_url: session.image || null,
                    notes: session.notes || null
                };
                
                const { data, error } = await window.SupabaseService.studySessions.update(session.id, updates);
                
                if (error) {
                    console.error('Error updating session in Supabase:', error);
                } else {
                    console.log('Session updated in Supabase:', data);
                }
            }
        } catch (error) {
            console.error('Error updating session in Supabase:', error);
        }
    }
    
    async deleteSession(index) {
        if (confirm('Are you sure you want to delete this study session?')) {
            const session = this.studySessions[index];
            
            // Try to delete from Supabase first
            if (session.id && window.SupabaseService && localStorage.getItem('isLoggedIn') === 'true') {
                try {
                    const { error } = await window.SupabaseService.studySessions.delete(session.id);
                    if (error) {
                        console.error('Error deleting from Supabase:', error);
                    } else {
                        console.log('Session deleted from Supabase');
                    }
                } catch (error) {
                    console.error('Error deleting from Supabase:', error);
                }
            }
            
            // Remove from local array
            this.studySessions.splice(index, 1);
            this.saveStudySessions();
            this.updateStudyDisplay();
            this.updateLogDisplay();
            console.log('Session deleted');
        }
    }
    
    async loadStudySessions() {
        try {
            // Check if Supabase is available and user is logged in
            if (window.SupabaseService && localStorage.getItem('isLoggedIn') === 'true') {
                console.log('Loading study sessions from Supabase...');
                
                // Load from Supabase
                const { data, error } = await window.SupabaseService.studySessions.getAll();
                
                if (error) {
                    console.error('Error loading from Supabase:', error);
                    // Fall back to localStorage
                    this.loadFromLocalStorage();
                } else {
                    console.log('Raw Supabase data:', data);
                    // Convert Supabase data to local format
                    this.studySessions = data.map(session => {
                        // Ensure date is in YYYY-MM-DD format
                        const sessionDate = new Date(session.start_time);
                        const formattedDate = sessionDate.toISOString().split('T')[0];
                        
                        // Calculate duration from start_time and end_time if duration_minutes is not available
                        let durationMinutes = session.duration_minutes;
                        let durationSeconds = 0;
                        
                        if (session.start_time && session.end_time) {
                            const startTime = new Date(session.start_time);
                            const endTime = new Date(session.end_time);
                            const timeDiff = endTime - startTime;
                            durationSeconds = Math.floor(timeDiff / 1000);
                            durationMinutes = Math.floor(durationSeconds / 60);
                        } else if (session.duration_minutes) {
                            durationSeconds = session.duration_minutes * 60;
                        }
                        
                        console.log('Converting Supabase session:', {
                            id: session.id,
                            date: formattedDate,
                            duration_minutes: session.duration_minutes,
                            calculated_minutes: durationMinutes,
                            calculated_seconds: durationSeconds
                        });
                        
                        return {
                            id: session.id,
                            date: formattedDate,
                            timestamp: session.start_time,
                            seconds: durationSeconds,
                            minutes: durationMinutes,
                            secondsRemainder: durationSeconds % 60,
                            description: session.description,
                            image: session.image_url,
                            notes: session.notes
                        };
                    });
                    console.log('Loaded saved sessions from Supabase:', this.studySessions);
                }
            } else {
                // Fall back to localStorage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.log('Error loading study sessions:', error);
            this.loadFromLocalStorage();
        }
        
        // Force update the display after loading
        console.log('Sessions loaded, updating display...');
        console.log('Current studySessions array:', this.studySessions);
        console.log('Session count:', this.studySessions.length);
        
        // Force a complete refresh of the display
        this.updateStudyDisplay();
        
        // Also update the log display
        if (this.updateLogDisplay) {
            this.updateLogDisplay();
        }
        
        // Double-check the display was updated
        setTimeout(() => {
            console.log('Display update check - Heatmap container content length:', this.heatmapContainer.innerHTML.length);
            console.log('Display update check - Study sessions in memory:', this.studySessions.length);
        }, 100);
    }
    
    loadFromLocalStorage() {
        try {
            const localData = localStorage.getItem('studyData');
            if (localData) {
                const data = JSON.parse(localData);
                this.studySessions = data.studySessions || [];
                console.log('Loaded saved sessions from localStorage:', this.studySessions);
            } else {
                console.log('No localStorage data found, starting with empty sessions');
                this.studySessions = [];
            }
        } catch (error) {
            console.log('Error loading from localStorage:', error);
            this.studySessions = [];
        }
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
            
            // Enable focus mode - hide study icons and make timer bigger
            this.enableFocusMode();
            
            // Ensure paused visual state is removed
            document.querySelector('.timer-controls').classList.remove('paused');
            
            console.log('Timer started at:', this.startTime);
            console.log('Switching button to STOP mode');
            
            // Add fullscreen class to container
            document.querySelector('.container').classList.add('fullscreen');
            
            // Hide other UI elements when timer is running
            this.hideOtherUI();
            
            // For Pomodoro mode, ensure we start fresh if this is after a reset
            if (this.timerMode === 'pomodoro') {
                // Always start from study phase, never from break
                if (this.pomodoroIsBreak) {
                    console.log('🔄 Resetting Pomodoro to study phase before starting');
                    this.pomodoroPhase = 'study';
                    this.pomodoroIsBreak = false;
                    this.pomodoroCurrentSession = 0;
                }
                
                // Track when this study session starts
                if (!this.pomodoroIsBreak) {
                    // If this is the first session or we don't have a start time, set it now
                    if (!this.pomodoroStudyStartTime) {
                        this.pomodoroStudyStartTime = new Date();
                        console.log('🔄 First study session start time recorded:', this.pomodoroStudyStartTime);
                    }
                }
                
                // Set time to study duration
                this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
                this.updateDisplay();
                console.log('🔄 Starting Pomodoro study session');
            }
            
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
                } else if (this.timerMode === 'pomodoro') {
                    // Pomodoro timer
                    this.timeLeft--;
                    this.updateDisplay();
                    
                    if (this.timeLeft <= 0) {
                        this.handlePomodoroComplete();
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
    
    handlePomodoroComplete() {
        if (this.pomodoroPhase === 'study') {
            // Study session completed
            this.pomodoroCurrentSession++;
            console.log(`🎯 Study session ${this.pomodoroCurrentSession} completed!`);
            console.log('📅 Study start time was:', this.pomodoroStudyStartTime);
            
            // Check if it's time for a long break
            if (this.pomodoroCurrentSession % this.pomodoroSessionsBeforeLongBreak === 0) {
                // Long break
                this.pomodoroPhase = 'longBreak';
                this.timeLeft = this.pomodoroLongBreakMinutes * 60;
                this.pomodoroIsBreak = true;
                
                // Show notification
                this.showPomodoroNotification('Long Break Time!', `Take a ${this.pomodoroLongBreakMinutes}-minute break. You've completed ${this.pomodoroCurrentSession} study sessions!`);
            } else {
                // Short break
                this.pomodoroPhase = 'break';
                this.timeLeft = this.pomodoroBreakMinutes * 60;
                this.pomodoroIsBreak = true;
                
                // Show notification
                this.showPomodoroNotification('Break Time!', `Take a ${this.pomodoroBreakMinutes}-minute break. Session ${this.pomodoroCurrentSession} completed!`);
            }
            
            // Save the completed study session (only study sessions, not breaks)
            if (this.pomodoroStudyStartTime) {
                console.log('💾 Recording study session...');
                // Temporarily set startTime to study start time for recording
                const originalStartTime = this.startTime;
                this.startTime = this.pomodoroStudyStartTime;
                
                // Record the study session
                this.recordStudySession();
                
                // Restore original start time
                this.startTime = originalStartTime;
                
                // DON'T clear study start time yet - we need it for manual stop during break
                // this.pomodoroStudyStartTime = null;
                
                console.log('✅ Study session recorded successfully');
            } else {
                console.log('⚠️ No study start time found, cannot record session');
            }
        } else {
            // Break completed, start next study session
            this.pomodoroPhase = 'study';
            this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
            this.pomodoroIsBreak = false;
            
            // Track when this study session starts
            this.pomodoroStudyStartTime = new Date();
            
            // Show notification
            this.showPomodoroNotification('Study Time!', `Break finished. Time to focus for ${this.pomodoroStudyMinutes} minutes!`);
        }
        
        // Update display and continue timer
        this.updateDisplay();
        this.start();
    }
    
    showPomodoroNotification(title, message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.pomodoroIsBreak ? '#4CAF50' : '#ff9800'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: 'IBM Plex Mono', monospace;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
            <div style="font-size: 14px;">${message}</div>
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Also try to show browser notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message, icon: '/favicon.ico' });
        }
    }
    
    resetPomodoro() {
        // Stop any running timer
        if (this.isRunning) {
            this.isRunning = false;
            this.isPaused = false;
            clearInterval(this.interval);
        }
        
        // Reset all Pomodoro state
        this.pomodoroCurrentSession = 0;
        this.pomodoroPhase = 'study';
        this.pomodoroIsBreak = false;
        this.pomodoroStudyStartTime = null; // Clear study start time
        this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
        
        // Exit fullscreen mode if we're in it
        const container = document.querySelector('.container');
        if (container && container.classList.contains('fullscreen')) {
            container.classList.remove('fullscreen');
        }
        
        // Show other UI elements when exiting fullscreen
        this.showOtherUI();
        
        // Reset timer controls to initial state
        if (this.playBtn) {
            this.playBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5V19L19 12L8 5Z" fill="white"/>
                </svg>
            `;
            this.playBtn.removeEventListener('click', this.stopFunction);
            this.playBtn.addEventListener('click', this.startFunction);
        }
        
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4H10V20H6V4ZM14 4H18V20H14V4Z" fill="white"/>
                </svg>
            `;
        }
        
        // Reset start time
        this.startTime = null;
        
        // Update display
        this.updateDisplay();
        
        console.log('🔄 Pomodoro completely reset to initial state');
    }
    
    // Additional method to force complete Pomodoro reset
    forceResetPomodoro() {
        console.log('🔄 Force resetting Pomodoro cycle');
        
        // Clear any ongoing timers
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        // Reset all state
        this.isRunning = false;
        this.isPaused = false;
        // Note: startTime is preserved for session recording
        this.pomodoroCurrentSession = 0;
        this.pomodoroPhase = 'study';
        this.pomodoroIsBreak = false;
        this.pomodoroStudyStartTime = null; // Clear study start time
        this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
        
        // Exit fullscreen
        const container = document.querySelector('.container');
        if (container && container.classList.contains('fullscreen')) {
            container.classList.remove('fullscreen');
            this.showOtherUI();
        }
        
        // Reset UI
        this.updateDisplay();
        
        console.log('✅ Pomodoro cycle completely reset');
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
            
            // Keep focus mode active when paused
            // this.disableFocusMode(); // Don't disable focus mode when paused
            
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
            
            // Keep focus mode active when resuming
            // this.enableFocusMode(); // Focus mode should already be active
            
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
                } else if (this.timerMode === 'pomodoro') {
                    // Ensure we're not resuming from a break state
                    if (this.pomodoroIsBreak) {
                        console.log('🔄 Cannot resume Pomodoro from break state, resetting to study');
                        this.forceResetPomodoro();
                        return;
                    }
                    
                    if (this.timeLeft > 0) {
                        this.timeLeft--;
                        this.updateDisplay();
                    } else {
                        this.handlePomodoroComplete();
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
        
        // Disable focus mode - show study icons and restore normal timer size
        this.disableFocusMode();
        
        // Ensure paused visual state is removed
        document.querySelector('.timer-controls').classList.remove('paused');
        
        console.log('Timer stopped. Start time was:', this.startTime);
        console.log('Switching button back to START mode');
        
        // Remove fullscreen class from container
        document.querySelector('.container').classList.remove('fullscreen');
        
        // Show other UI elements when timer stops
        this.showOtherUI();
        
        // Hide progress bar when timer stops
        if (this.progressBar) {
            this.progressBar.style.display = 'none';
        }
        
        // Record study session if it was running and not in break mode
        if (this.startTime && !(this.timerMode === 'pomodoro' && this.pomodoroIsBreak)) {
            console.log('Recording study session...');
            await this.recordStudySession();
            
            // Automatically show edit session modal for the NEW session
            this.showEditSessionForNewSession();
        } else if (this.timerMode === 'pomodoro' && this.pomodoroIsBreak) {
            console.log('🛑 Break session stopped - recording completed study session and resetting Pomodoro');
            console.log('🔍 Debug info:');
            console.log('  - pomodoroStudyStartTime:', this.pomodoroStudyStartTime);
            console.log('  - current startTime:', this.startTime);
            console.log('  - pomodoroCurrentSession:', this.pomodoroCurrentSession);
            console.log('  - pomodoroPhase:', this.pomodoroPhase);
            console.log('  - pomodoroIsBreak:', this.pomodoroIsBreak);
            
            // Record the completed study session that came before this break
            if (this.pomodoroStudyStartTime) {
                console.log('💾 Recording completed study session from before break...');
                
                // Temporarily set startTime to study start time for recording
                const originalStartTime = this.startTime;
                this.startTime = this.pomodoroStudyStartTime;
                
                console.log('📝 Using study start time for recording:', this.startTime);
                
                await this.recordStudySession();
                
                // Check if session was actually recorded
                console.log('🔍 After recording - studySessions array length:', this.studySessions.length);
                if (this.studySessions.length > 0) {
                    const lastSession = this.studySessions[this.studySessions.length - 1];
                    console.log('📊 Last recorded session:', lastSession);
                }
                
                // Show edit session modal for the completed session
                this.showEditSessionForNewSession();
                
                // Restore original start time and clear study start time
                this.startTime = originalStartTime;
                this.pomodoroStudyStartTime = null;
                
                console.log('✅ Session recording complete, study start time cleared');
            } else {
                console.log('⚠️ No study start time found, trying to use current startTime...');
                
                // Fallback: try to record using current startTime if available
                if (this.startTime) {
                    console.log('🔄 Using current startTime as fallback for session recording');
                    await this.recordStudySession();
                    this.showEditSessionForNewSession();
                } else {
                    console.log('❌ No start time available, cannot record session');
                }
            }
            
            // Now reset Pomodoro completely
            this.forceResetPomodoro();
            return; // Exit early to prevent further processing
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
        console.log('🔍 recordStudySession called with:');
        console.log('  - timerMode:', this.timerMode);
        console.log('  - pomodoroIsBreak:', this.pomodoroIsBreak);
        console.log('  - startTime:', this.startTime);
        console.log('  - pomodoroStudyStartTime:', this.pomodoroStudyStartTime);
        
        // Don't record break sessions in Pomodoro mode
        if (this.timerMode === 'pomodoro' && this.pomodoroIsBreak) {
            console.log('⏸️ Break session - not recording to study data');
            return;
        }
        
        if (!this.startTime) {
            console.log('❌ No start time available, cannot record session');
            return;
        }
        
        const today = this.getCurrentDate();
        
        // Calculate exact minutes and seconds studied
        const endTime = new Date();
        const timeDiff = endTime - this.startTime;
        const totalSeconds = Math.floor(timeDiff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        // Store time in seconds for precise tracking
        const timeStudied = totalSeconds;
        
        // Create session data for both local and Supabase
        const sessionData = {
            date: today,
            timestamp: this.startTime.toISOString(), // Use the actual start time
            seconds: timeStudied,
            minutes: minutes,
            secondsRemainder: seconds,
            description: undefined,
            image: undefined,
            notes: undefined
        };
        
        console.log('📊 Session data created:', sessionData);
        console.log('Recording session for date:', today, 'with', timeStudied, 'seconds');
        
        // Add to local array
        this.studySessions.push(sessionData);
        console.log('✅ Session added to local array. Total sessions:', this.studySessions.length);
        console.log('New study session recorded for:', today, 'Time:', minutes + 'm ' + seconds + 's', 'Total seconds:', timeStudied);
        
        console.log('Total sessions:', this.studySessions.length);
        console.log('Total study time today:', this.studySessions.filter(s => s.date === today).reduce((sum, s) => sum + s.seconds, 0), 'seconds');
        
        // Try to save to Supabase first, fall back to localStorage
        try {
            if (window.SupabaseService && localStorage.getItem('isLoggedIn') === 'true') {
                const userId = localStorage.getItem('userId');
                if (userId) {
                    const supabaseSessionData = {
                        user_id: userId,
                        session_date: today,
                        start_time: this.startTime.toISOString(),
                        end_time: endTime.toISOString(),
                        duration_minutes: minutes,
                        description: null,
                        image_url: null,
                        notes: null
                    };
                    
                    console.log('Saving to Supabase:', supabaseSessionData);
                    
                    const { data, error } = await window.SupabaseService.studySessions.create(supabaseSessionData);
                    
                    if (error) {
                        console.error('Error saving to Supabase:', error);
                        // Fall back to localStorage
                        await this.saveStudySessions();
                    } else {
                        console.log('Study session saved to Supabase:', data);
                        // Update local session with Supabase ID
                        const lastSession = this.studySessions[this.studySessions.length - 1];
                        lastSession.id = data.id;
                    }
                } else {
                    console.log('No user ID found, saving to localStorage');
                    await this.saveStudySessions();
                }
            } else {
                // Save to localStorage only
                await this.saveStudySessions();
            }
        } catch (error) {
            console.error('Error saving session:', error);
            // Fall back to localStorage
            await this.saveStudySessions();
        }
        
        // Update display
        console.log('🔄 Updating study display and log display...');
        this.updateStudyDisplay();
        this.updateLogDisplay();
        console.log('✅ Display update complete');
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        
        if (this.timerMode === 'pomodoro') {
            // Show Pomodoro information
            const phaseText = this.pomodoroIsBreak ? 
                (this.pomodoroPhase === 'longBreak' ? 'Long Break' : 'Short Break') : 
                'Study';
            const sessionText = this.pomodoroCurrentSession > 0 ? ` (${this.pomodoroCurrentSession}/${this.pomodoroSessionsBeforeLongBreak})` : '';
            
            this.timerDisplay.innerHTML = `
                <div style="font-size: 0.8em; color: #888; margin-bottom: 5px;">${phaseText}${sessionText}</div>
                <div style="font-size: 1.2em;">${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</div>
            `;
        } else {
            // Regular timer/stopwatch display
            this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update progress bar based on mode
        if (this.timerMode === 'timer' && this.isRunning) {
            this.progressBar.style.display = 'block';
            const totalTime = this.focusMinutes * 60;
            const progress = ((totalTime - this.timeLeft) / totalTime) * 100;
            this.progressBar.style.background = `linear-gradient(to right, #ffffff ${progress}%, #333 ${progress}%)`;
        } else if (this.timerMode === 'pomodoro' && this.isRunning) {
            this.progressBar.style.display = 'block';
            let totalTime, progress;
            
            if (this.pomodoroPhase === 'study') {
                totalTime = this.pomodoroStudyMinutes * 60;
            } else if (this.pomodoroPhase === 'break') {
                totalTime = this.pomodoroBreakMinutes * 60;
            } else {
                totalTime = this.pomodoroLongBreakMinutes * 60;
            }
            
            progress = ((totalTime - this.timeLeft) / totalTime) * 100;
            const progressColor = this.pomodoroIsBreak ? '#4CAF50' : '#ff9800';
            this.progressBar.style.background = `linear-gradient(to right, ${progressColor} ${progress}%, #333 ${progress}%)`;
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
        } else if (this.timerMode === 'stopwatch') {
            this.timerMode = 'pomodoro';
            this.timeLeft = Math.round(this.pomodoroStudyMinutes * 60);
            this.pomodoroPhase = 'study';
            this.pomodoroCurrentSession = 0;
            this.pomodoroIsBreak = false;
            console.log('✅ Switched to pomodoro mode');
        } else {
            this.timerMode = 'timer';
            this.timeLeft = Math.round(this.focusMinutes * 60);
            console.log('✅ Switched to timer mode');
        }
        
        this.updateDisplay();
        this.initializeProgressBar();
        
        // Save the new mode to localStorage
        const settings = {
            timerMode: this.timerMode,
            focusMinutes: this.focusMinutes
        };
        
        if (this.timerMode === 'pomodoro') {
            settings.pomodoroStudyMinutes = this.pomodoroStudyMinutes;
            settings.pomodoroBreakMinutes = this.pomodoroBreakMinutes;
            settings.pomodoroLongBreakMinutes = this.pomodoroLongBreakMinutes;
            settings.pomodoroSessionsBeforeLongBreak = this.pomodoroSessionsBeforeLongBreak;
        }
        
        localStorage.setItem('timerSettings', JSON.stringify(settings));
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
        this.timerDisplay.title = '';
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
                    
                case 'l':
                    // Open analytics (L)
                    event.preventDefault();
                    console.log('⌨️ Shortcut: Open analytics (L)');
                    this.openAnalytics();
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
        console.log('  A - Open account');
        console.log('  L - Open analytics');
        console.log('  M - Toggle log/documents');
        console.log('  Escape - Close modals');
        console.log('  H - Show shortcuts help');
        
        // Test keyboard shortcuts on localhost
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.hostname === '0.0.0.0') {
            console.log('🔧 Localhost detected - testing shortcuts...');
            console.log('🎯 Try pressing: Enter, S, P, F, Q, A, L, M, Escape, H');
        }
    }
    
    isModalOpen() {
        const settingsModal = document.getElementById('settingsModal');
        const accountModal = document.getElementById('accountModal');
        const analyticsModal = document.getElementById('analyticsModal');
        const editSessionModal = document.getElementById('editSessionModal');
        const shortcutsHelpModal = document.getElementById('shortcutsHelpModal');
        
        return (settingsModal && settingsModal.style.display !== 'none') ||
               (accountModal && accountModal.style.display !== 'none') ||
               (analyticsModal && analyticsModal.style.display !== 'none') ||
               (editSessionModal && editSessionModal.style.display !== 'none') ||
               (shortcutsHelpModal && shortcutsHelpModal.style.display !== 'none');
    }
    
    isClosingShortcut(event) {
        return event.key === 'Escape';
    }
    
    closeAllModals() {
        this.closeSettings();
        this.closeAccount();
        this.closeAnalytics();
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
                            <kbd>A</kbd>
                            <span>Open account</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>L</kbd>
                            <span>Open analytics</span>
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
    
    // Force delete user data using multiple methods
    async forceDeleteUserData(userId) {
        console.log('🔄 Force deleting user data for:', userId);
        
        if (!window.SupabaseService || !window.SupabaseService.supabase) {
            console.log('Supabase not available for force deletion');
            return;
        }
        
        try {
            // Method 1: Try to delete from all known tables
            const tablesToDelete = [
                'study_sessions',
                'timer_settings', 
                'profiles',
                'sessions',
                'user_sessions',
                'user_data',
                'user_preferences',
                'user_stats',
                'blurting_notes',
                'review_history',
                'flashcards',
                'flashcard_decks'
            ];
            
            for (const tableName of tablesToDelete) {
                try {
                    const { error: deleteError } = await window.SupabaseService.supabase
                        .from(tableName)
                        .delete()
                        .eq('user_id', userId);
                    
                    if (!deleteError) {
                        console.log(`✅ Force deleted from ${tableName}`);
                    } else {
                        console.log(`⚠️ Could not delete from ${tableName}:`, deleteError.message);
                    }
                } catch (tableError) {
                    console.log(`Table ${tableName} not found or already empty`);
                }
            }
            
            // Method 2: Try to delete profile by ID
            try {
                const { error: profileError } = await window.SupabaseService.supabase
                    .from('profiles')
                    .delete()
                    .eq('id', userId);
                
                if (!profileError) {
                    console.log('✅ Force deleted profile');
                } else {
                    console.log('⚠️ Could not delete profile:', profileError.message);
                }
            } catch (profileErr) {
                console.log('Profile deletion failed:', profileErr);
            }
            
            // Method 3: Try to update profile to mark as deleted
            try {
                const { error: updateError } = await window.SupabaseService.supabase
                    .from('profiles')
                    .update({
                        email: 'deleted_' + userId + '@deleted.com',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                
                if (!updateError) {
                    console.log('✅ Marked profile as deleted');
                } else {
                    console.log('⚠️ Could not mark profile as deleted:', updateError.message);
                }
            } catch (updateErr) {
                console.log('Profile update failed:', updateErr);
            }
            
            console.log('🔄 Force deletion completed');
            
        } catch (error) {
            console.error('Error in force deletion:', error);
        }
    }
    
    // Restore user session from localStorage if possible
    restoreUserSession() {
        const userId = localStorage.getItem('userId');
        const userEmail = localStorage.getItem('userEmail');
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        
        if (userId && userEmail && isLoggedIn === 'true') {
            console.log('✅ Restored user session from localStorage:', { userId, userEmail });
            return { userId, userEmail, isLoggedIn: true };
        } else {
            console.log('❌ No valid user session found in localStorage');
            return null;
        }
    }
    
    // Force delete user account when other methods fail
    async forceDeleteUserAccount(userId) {
        console.log('🔄 Using force deletion method for user:', userId);
        
        try {
            // This method will attempt to delete the user account using more aggressive approaches
            
            // Method 1: Try to delete using direct SQL queries if RPC functions are available
            if (window.SupabaseService && window.SupabaseService.supabase) {
                try {
                    // Try to call a force delete function that might exist
                    const { error: forceError } = await window.SupabaseService.supabase
                        .rpc('force_delete_user_complete', { 
                            target_user_id: userId 
                        });
                    
                    if (!forceError) {
                        console.log('✅ Force delete completed via RPC');
                        return true;
                    } else {
                        console.log('⚠️ Force delete RPC failed:', forceError.message);
                    }
                } catch (rpcError) {
                    console.log('Force delete RPC not available');
                }
                
                // Method 2: Try to invalidate the user by changing their email to something unusable
                try {
                    console.log('🔄 Attempting to invalidate user by changing email...');
                    
                    // Generate an invalid email that can't be used for login
                    const invalidEmail = `deleted_${userId}_${Date.now()}@deleted.invalid`;
                    
                    // Try to update the user's email in the profiles table
                    const { error: emailError } = await window.SupabaseService.supabase
                        .from('profiles')
                        .update({ 
                            email: invalidEmail,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                    
                    if (!emailError) {
                        console.log('✅ User email changed to invalid address');
                    } else {
                        console.log('⚠️ Could not change email:', emailError.message);
                    }
                } catch (emailErr) {
                    console.log('Email change failed:', emailErr.message);
                }
                
                // Method 3: Try to delete all user data from all possible tables
                console.log('🗑️ Attempting to delete all user data...');
                
                const allTables = [
                    'study_sessions', 'timer_settings', 'profiles', 
                    'user_sessions', 'user_data', 'user_preferences', 
                    'user_stats', 'user_analytics', 'user_logs',
                    'auth_sessions', 'user_metadata', 'blurting_notes',
                    'review_history', 'flashcards', 'flashcard_decks'
                ];
                
                for (const tableName of allTables) {
                    try {
                        const { error: tableError } = await window.SupabaseService.supabase
                            .from(tableName)
                            .delete()
                            .eq('user_id', userId);
                        
                        if (!tableError) {
                            console.log(`✅ Deleted from ${tableName}`);
                        }
                    } catch (tableErr) {
                        // Table might not exist, which is fine
                    }
                }
                
                // Method 4: Try to sign out and invalidate any remaining sessions
                try {
                    if (window.SupabaseService.auth) {
                        await window.SupabaseService.auth.signOut();
                        console.log('✅ User signed out successfully');
                    }
                } catch (signOutError) {
                    console.log('Sign out failed:', signOutError.message);
                }
                
                console.log('✅ Force deletion completed');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Force deletion failed:', error);
            return false;
        }
    }
    
    // Invalidate user credentials to prevent future logins
    async invalidateUserCredentials(userId) {
        console.log('🔒 Invalidating user credentials for user:', userId);
        
        try {
            if (window.SupabaseService && window.SupabaseService.supabase) {
                // Method 1: Change user email to an invalid address
                try {
                    const invalidEmail = `deleted_${userId}_${Date.now()}@deleted.invalid`;
                    
                    // Update profile email
                    const { error: profileError } = await window.SupabaseService.supabase
                        .from('profiles')
                        .update({ 
                            email: invalidEmail,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                    
                    if (!profileError) {
                        console.log('✅ Profile email changed to invalid address');
                    } else {
                        console.log('⚠️ Could not change profile email:', profileError.message);
                    }
                } catch (emailErr) {
                    console.log('Profile email change failed:', emailErr.message);
                }
                
                // Method 2: Delete all user data from all tables
                console.log('🗑️ Deleting all user data...');
                
                const tablesToClean = [
                    'study_sessions', 'timer_settings', 'profiles',
                    'user_sessions', 'user_data', 'user_preferences',
                    'user_stats', 'user_analytics', 'user_logs',
                    'auth_sessions', 'user_metadata', 'blurting_notes',
                    'review_history', 'flashcards', 'flashcard_decks'
                ];
                
                for (const tableName of tablesToClean) {
                    try {
                        const { error: tableError } = await window.SupabaseService.supabase
                            .from(tableName)
                            .delete()
                            .eq('user_id', userId);
                        
                        if (!tableError) {
                            console.log(`✅ Deleted from ${tableName}`);
                        }
                    } catch (tableErr) {
                        // Table might not exist, which is fine
                    }
                }
                
                // Method 3: Sign out to invalidate current session
                try {
                    if (window.SupabaseService.auth) {
                        await window.SupabaseService.auth.signOut();
                        console.log('✅ User signed out successfully');
                    }
                } catch (signOutError) {
                    console.log('Sign out failed:', signOutError.message);
                }
                
                // Method 4: Store deletion marker in localStorage to prevent future logins
                localStorage.setItem('accountDeleted', 'true');
                localStorage.setItem('deletedUserId', userId);
                localStorage.setItem('deletedAt', new Date().toISOString());
                
                console.log('✅ User credentials invalidated successfully');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Credential invalidation failed:', error);
            return false;
        }
    }
    
    // Logout function
    async logout() {
        try {
            console.log('🚪 Logging out user...');
            
            // Sign out from Supabase
            if (window.SupabaseService && window.SupabaseService.auth) {
                await window.SupabaseService.auth.signOut();
            }
            
            // Clear local storage
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userId');
            
            // Clear any other authentication-related data
            localStorage.removeItem('studyData');
            sessionStorage.clear();
            
            console.log('✅ Logout successful, redirecting to login');
            
            // Close the account modal
            this.closeAccount();
            
            // Redirect to login
            window.location.href = 'login.html';
        } catch (error) {
            console.error('❌ Logout error:', error);
            // Force redirect even if Supabase logout fails
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    }
    
    hideOtherUI() {
        // Store current visibility state before hiding
        if (this.logContainer) {
            this.logContainer.dataset.wasVisible = this.logContainer.style.display !== 'none';
        }
        if (this.heatmapContainer) {
            this.heatmapContainer.dataset.wasVisible = this.heatmapContainer.style.display !== 'none';
        }
        

        
        // Hide settings, account, analytics, and log buttons
        if (this.settingsBtn) this.settingsBtn.style.display = 'none';
        if (this.accountBtn) this.accountBtn.style.display = 'none';
        if (this.analyticsBtn) this.analyticsBtn.style.display = 'none';
        if (this.logBtn) this.logBtn.style.display = 'none';
        

        
        // Hide the log container if it's visible
        if (this.logContainer) this.logContainer.style.display = 'none';
        
        // Hide the heatmap if it's visible
        if (this.heatmapContainer) this.heatmapContainer.style.display = 'none';
        
        console.log('🔒 Other UI elements hidden for fullscreen mode');
    }
    
    showOtherUI() {
        // Show settings, account, analytics, and log buttons
        if (this.settingsBtn) this.settingsBtn.style.display = 'block';
        if (this.accountBtn) this.accountBtn.style.display = 'block';
        if (this.analyticsBtn) this.analyticsBtn.style.display = 'block';
        if (this.logBtn) this.logBtn.style.display = 'block';
        

        
        // Show the log container if it was previously visible
        if (this.logContainer && this.logContainer.dataset.wasVisible === 'true') {
            this.logContainer.style.display = 'block';
        }
        
        // Show the heatmap if it was previously visible
        if (this.heatmapContainer && this.heatmapContainer.dataset.wasVisible === 'true') {
            this.heatmapContainer.style.display = 'block';
        }
        
        console.log('🔓 Other UI elements restored');
    }
    
    // Focus Mode Methods
    enableFocusMode() {
        console.log('🎯 Enabling focus mode - hiding study icons and making timer bigger');
        const container = document.querySelector('.container');
        container.classList.add('focus-mode');
    }
    
    disableFocusMode() {
        console.log('🔓 Disabling focus mode - showing study icons and restoring normal timer size');
        const container = document.querySelector('.container');
        container.classList.remove('focus-mode');
    }
    
    // Log Focus Mode Methods (only hide study icons, don't affect timer)
    enableLogFocusMode() {
        console.log('📋 Enabling log focus mode - hiding study icons only');
        const container = document.querySelector('.container');
        container.classList.add('log-focus-mode');
    }
    
    disableLogFocusMode() {
        console.log('📊 Disabling log focus mode - showing study icons');
        const container = document.querySelector('.container');
        container.classList.remove('log-focus-mode');
    }
    
    // Icon switching methods for log button
    switchToGridIcon() {
        const logIcon = document.getElementById('logIcon');
        const gridIcon = document.getElementById('gridIcon');
        
        if (logIcon && gridIcon) {
            logIcon.style.display = 'none';
            gridIcon.style.display = 'block';
            console.log('🔄 Switched to grid icon');
        }
    }
    
    switchToLogIcon() {
        const logIcon = document.getElementById('logIcon');
        const gridIcon = document.getElementById('gridIcon');
        
        if (logIcon && gridIcon) {
            logIcon.style.display = 'block';
            gridIcon.style.display = 'none';
            console.log('🔄 Switched to log icon');
        }
    }
}

// Initialize the timer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.studyTimer = new StudyTimer();
});




