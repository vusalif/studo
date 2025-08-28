// Goal Setting System
class GoalSettingSystem {
    constructor() {
        this.goals = [];
        this.currentGoal = null;
        this.isInitialized = false;
        
        // Initialize when DOM is ready
        this.initialize();
    }
    
    async initialize() {
        try {
            // Wait for Supabase to be ready
            await this.waitForSupabase();
            
            // Initialize the system
            this.initializeEventListeners();
            this.isInitialized = true;
            
            // Check if database is set up and load data
            const dbSetup = await this.checkDatabaseSetup();
            if (!dbSetup) {
                this.showDatabaseSetupMessage();
                return;
            }
            
            // Load goals
            await this.loadGoals();
            
            console.log('Goal setting system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize goal setting system:', error);
            this.showNotification('Failed to initialize system. Please refresh the page.', 'error');
            this.hideLoadingState();
        }
    }
    
    async checkDatabaseSetup() {
        try {
            // Try to query the goals table
            const { data, error } = await window.supabaseClient
                .from('goals')
                .select('id')
                .limit(1);
            
            if (error) {
                if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('404') || error.message?.includes('Could not find the table')) {
                    console.log('Goals table does not exist:', error.message);
                    return false; // Tables don't exist
                }
                // Other errors might be network-related, assume tables exist
                console.log('Database check error (assuming tables exist):', error);
                return true;
            }
            
            return true; // Tables exist
        } catch (error) {
            console.log('Database setup check failed:', error);
            return false;
        }
    }
    
    showDatabaseSetupMessage() {
        const goalsGrid = document.getElementById('goals-grid');
        goalsGrid.innerHTML = `
            <div class="database-setup-message">
                <div class="setup-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF9500"/>
                    </svg>
                </div>
                <h3>Database Setup Required</h3>
                <p>The goals database table needs to be created in your Supabase project.</p>
                <div class="setup-steps">
                    <ol>
                        <li>Go to your <strong>Supabase project dashboard</strong></li>
                        <li>Navigate to the <strong>SQL Editor</strong></li>
                        <li>Copy and paste the contents of <code>goal-setting-setup.sql</code> file</li>
                        <li>Run the SQL script</li>
                        <li>Refresh this page</li>
                    </ol>
                </div>
                <div class="setup-note">
                    <p><strong>Note:</strong> The SQL file includes the complete table structure, indexes, Row Level Security policies, and triggers for automatic timestamp updates.</p>
                </div>
                <button class="btn btn-primary" onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;
    }
    
    async waitForSupabase() {
        // Wait for Supabase client to be available
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds max wait
        
        while (attempts < maxAttempts) {
            if (window.supabaseClient && window.supabaseClient.auth) {
                console.log('Supabase client ready, proceeding with initialization');
                return true;
            }
            
            // Wait 100ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Supabase client not ready after 10 seconds');
    }
    
    initializeEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Goal creation
        document.getElementById('create-goal-btn').addEventListener('click', () => this.switchTab('create'));
        document.getElementById('save-goal-btn').addEventListener('click', () => this.createGoal());
        document.getElementById('cancel-goal-btn').addEventListener('click', () => this.switchTab('goals'));
        
        // Edit goal modal
        document.getElementById('close-edit-goal-modal').addEventListener('click', () => this.hideEditGoalModal());
        document.getElementById('cancel-edit-goal-btn').addEventListener('click', () => this.hideEditGoalModal());
        document.getElementById('save-edit-goal-btn').addEventListener('click', () => this.updateGoal());
        document.getElementById('delete-goal-btn').addEventListener('click', () => this.deleteGoal());
        
        // Progress filter
        document.getElementById('progress-filter').addEventListener('change', (e) => this.filterProgress(e.target.value));
        
        // Date fields toggle
        document.getElementById('enable-dates').addEventListener('change', (e) => this.toggleDateFields(e.target.checked));
        
        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Set default dates
        this.setDefaultDates();
    }
    
    setDefaultDates() {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        document.getElementById('goal-start-date').value = today.toISOString().split('T')[0];
        document.getElementById('goal-end-date').value = nextWeek.toISOString().split('T')[0];
    }
    
    toggleDateFields(enabled) {
        const dateFields = document.getElementById('date-fields');
        const startDateInput = document.getElementById('goal-start-date');
        const endDateInput = document.getElementById('goal-end-date');
        
        if (enabled) {
            dateFields.style.display = 'grid';
            startDateInput.required = true;
            endDateInput.required = true;
        } else {
            dateFields.style.display = 'none';
            startDateInput.required = false;
            endDateInput.required = false;
            startDateInput.value = '';
            endDateInput.value = '';
        }
    }
    
    // Tab Management
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        // Load data for specific tabs
        if (tabName === 'progress') {
            this.updateProgressStats();
        }
    }
    
    // Goal Management
    async loadGoals() {
        try {
            const { data: goals, error } = await this.getGoals();
            if (error) {
                if (error.code === 'TABLE_NOT_FOUND') {
                    // Table doesn't exist, show setup message
                    this.showDatabaseSetupMessage();
                    return;
                }
                throw error;
            }
            
            this.goals = goals || [];
            this.renderGoals();
        } catch (error) {
            console.error('Failed to load goals:', error);
            this.showNotification('Failed to load goals', 'error');
            // Show empty state on error
            this.renderGoals();
        }
    }
    
    showLoadingState() {
        const loadingState = document.getElementById('loading-state');
        if (loadingState) {
            loadingState.style.display = 'block';
        }
    }
    
    hideLoadingState() {
        const loadingState = document.getElementById('loading-state');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }
    
    renderGoals() {
        const goalsGrid = document.getElementById('goals-grid');
        if (!goalsGrid) return;
        
        this.hideLoadingState();
        
        if (this.goals.length === 0) {
            goalsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="64" height="64">
                            <path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#666"/>
                        </svg>
                    </div>
                    <h3>No Goals Yet</h3>
                    <p>Create your first study goal to get started!</p>
                    <button class="btn btn-primary" onclick="goalSettingSystem.switchTab('create')">
                        Create Your First Goal
                    </button>
                </div>
            `;
            return;
        }
        
        goalsGrid.innerHTML = this.goals.map(goal => `
            <div class="goal-card" data-goal-id="${goal.id}">
                <div class="goal-header">
                    <h3 class="goal-title">${this.escapeHtml(goal.title)}</h3>
                    <div class="goal-actions">
                        <button class="action-btn edit" data-goal-id="${goal.id}" title="Edit Goal">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" data-goal-id="${goal.id}" title="Delete Goal">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="goal-description">${this.escapeHtml(goal.description || 'No description')}</div>
                
                <div class="goal-progress">
                    <div class="progress-info">
                        <span class="progress-text">${goal.current_progress || 0} / ${goal.target_value}</span>
                        <span class="progress-percentage">${Math.round(((goal.current_progress || 0) / goal.target_value) * 100)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(((goal.current_progress || 0) / goal.target_value) * 100, 100)}%"></div>
                    </div>
                </div>
                
                <div class="goal-meta">
                    <div class="goal-type">${this.formatGoalType(goal.goal_type)}</div>
                    <div class="goal-priority priority-${goal.priority}">${goal.priority}</div>
                    <button class="update-progress-btn" data-goal-id="${goal.id}" title="Update Progress">
                        Update Progress
                    </button>
                </div>
                
                ${goal.start_date && goal.end_date ? `
                <div class="goal-dates">
                    ${this.formatDate(goal.start_date)} - ${this.formatDate(goal.end_date)}
                </div>
                ` : ''}
            </div>
        `).join('');
        
        // Add event listeners to goal actions
        this.goals.forEach(goal => {
            const editBtn = goalsGrid.querySelector(`[data-goal-id="${goal.id}"].edit`);
            const deleteBtn = goalsGrid.querySelector(`[data-goal-id="${goal.id}"].delete`);
            const updateProgressBtn = goalsGrid.querySelector(`[data-goal-id="${goal.id}"].update-progress-btn`);
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editGoal(goal);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.confirmDeleteGoal(goal);
                });
            }
            
            if (updateProgressBtn) {
                updateProgressBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.updateProgress(goal);
                });
            }
        });
    }
    
    async createGoal() {
        const title = document.getElementById('goal-title').value.trim();
        const description = document.getElementById('goal-description').value.trim();
        const goalType = document.getElementById('goal-type').value;
        const targetValue = parseInt(document.getElementById('goal-target').value);
        const enableDates = document.getElementById('enable-dates').checked;
        const startDate = enableDates ? document.getElementById('goal-start-date').value : null;
        const endDate = enableDates ? document.getElementById('goal-end-date').value : null;
        const priority = document.getElementById('goal-priority').value;
        
        if (!title) {
            this.showNotification('Please enter a goal title', 'error');
            return;
        }
        
        if (!targetValue || targetValue <= 0) {
            this.showNotification('Please enter a valid target value', 'error');
            return;
        }
        
        if (enableDates) {
            if (!startDate || !endDate) {
                this.showNotification('Please select start and end dates', 'error');
                return;
            }
            
            if (new Date(startDate) >= new Date(endDate)) {
                this.showNotification('End date must be after start date', 'error');
                return;
            }
        }
        
        try {
            const goalData = {
                title,
                description,
                goal_type: goalType,
                target_value: targetValue,
                current_progress: 0,
                start_date: startDate,
                end_date: endDate,
                priority,
                status: 'active'
            };
            
            const { data: newGoal, error } = await this.saveGoal(goalData);
            if (error) throw error;
            
            this.goals.unshift(newGoal);
            this.renderGoals();
            this.switchTab('goals');
            this.clearCreateForm();
            
            this.showNotification('Goal created successfully!', 'success');
        } catch (error) {
            console.error('Failed to create goal:', error);
            this.showNotification('Failed to create goal. Please try again.', 'error');
        }
    }
    
    clearCreateForm() {
        document.getElementById('goal-title').value = '';
        document.getElementById('goal-description').value = '';
        document.getElementById('goal-type').value = 'study-time';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-priority').value = 'medium';
        document.getElementById('enable-dates').checked = true;
        this.setDefaultDates();
        this.toggleDateFields(true);
    }
    
    editGoal(goal) {
        this.currentGoal = goal;
        
        document.getElementById('edit-goal-title').value = goal.title;
        document.getElementById('edit-goal-description').value = goal.description || '';
        document.getElementById('edit-goal-target').value = goal.target_value;
        document.getElementById('edit-goal-start-date').value = goal.start_date || '';
        document.getElementById('edit-goal-end-date').value = goal.end_date || '';
        document.getElementById('edit-goal-priority').value = goal.priority;
        
        this.showEditGoalModal();
    }
    
    showEditGoalModal() {
        document.getElementById('edit-goal-modal').style.display = 'flex';
    }
    
    hideEditGoalModal() {
        document.getElementById('edit-goal-modal').style.display = 'none';
        this.currentGoal = null;
    }
    
    async updateGoal() {
        if (!this.currentGoal) return;
        
        const title = document.getElementById('edit-goal-title').value.trim();
        const description = document.getElementById('edit-goal-description').value.trim();
        const targetValue = parseInt(document.getElementById('edit-goal-target').value);
        const startDate = document.getElementById('edit-goal-start-date').value || null;
        const endDate = document.getElementById('edit-goal-end-date').value || null;
        const priority = document.getElementById('edit-goal-priority').value;
        
        if (!title) {
            this.showNotification('Please enter a goal title', 'error');
            return;
        }
        
        if (!targetValue || targetValue <= 0) {
            this.showNotification('Please enter a valid target value', 'error');
            return;
        }
        
        if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
            this.showNotification('End date must be after start date', 'error');
            return;
        }
        
        try {
            const goalData = {
                title,
                description,
                target_value: targetValue,
                start_date: startDate,
                end_date: endDate,
                priority
            };
            
            const { error } = await this.updateGoalData(this.currentGoal.id, goalData);
            if (error) throw error;
            
            // Update local goal
            const goalIndex = this.goals.findIndex(g => g.id === this.currentGoal.id);
            if (goalIndex !== -1) {
                this.goals[goalIndex] = { ...this.goals[goalIndex], ...goalData };
            }
            
            this.renderGoals();
            this.hideEditGoalModal();
            
            this.showNotification('Goal updated successfully!', 'success');
        } catch (error) {
            console.error('Failed to update goal:', error);
            this.showNotification('Failed to update goal. Please try again.', 'error');
        }
    }
    
    async deleteGoal() {
        if (!this.currentGoal) return;
        
        if (!confirm(`Are you sure you want to delete "${this.currentGoal.title}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const { error } = await this.deleteGoalData(this.currentGoal.id);
            if (error) throw error;
            
            this.goals = this.goals.filter(g => g.id !== this.currentGoal.id);
            this.renderGoals();
            this.hideEditGoalModal();
            
            this.showNotification('Goal deleted successfully!', 'success');
        } catch (error) {
            console.error('Failed to delete goal:', error);
            this.showNotification('Failed to delete goal. Please try again.', 'error');
        }
    }
    
    confirmDeleteGoal(goal) {
        this.currentGoal = goal;
        this.showEditGoalModal();
        // Focus on delete button
        setTimeout(() => {
            document.getElementById('delete-goal-btn').focus();
        }, 100);
    }
    
    updateProgress(goal) {
        const currentProgress = goal.current_progress || 0;
        const targetValue = goal.target_value;
        
        const newProgress = prompt(
            `Update progress for "${goal.title}"\n\nCurrent: ${currentProgress} / ${targetValue}\nEnter new progress value:`,
            currentProgress
        );
        
        if (newProgress === null) return; // User cancelled
        
        const progressValue = parseInt(newProgress);
        if (isNaN(progressValue) || progressValue < 0) {
            this.showNotification('Please enter a valid progress value', 'error');
            return;
        }
        
        if (progressValue > targetValue) {
            if (!confirm(`Progress value (${progressValue}) is greater than target (${targetValue}). Continue?`)) {
                return;
            }
        }
        
        this.updateGoalProgress(goal.id, progressValue);
    }
    
    async updateGoalProgress(goalId, newProgress) {
        try {
            const goalData = {
                current_progress: newProgress,
                status: newProgress >= this.goals.find(g => g.id === goalId).target_value ? 'completed' : 'active'
            };
            
            const { error } = await this.updateGoalData(goalId, goalData);
            if (error) throw error;
            
            // Update local goal
            const goalIndex = this.goals.findIndex(g => g.id === goalId);
            if (goalIndex !== -1) {
                this.goals[goalIndex] = { ...this.goals[goalIndex], ...goalData };
            }
            
            this.renderGoals();
            this.showNotification('Progress updated successfully!', 'success');
        } catch (error) {
            console.error('Failed to update progress:', error);
            this.showNotification('Failed to update progress. Please try again.', 'error');
        }
    }
    
    // Database Methods
    async getGoals() {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { data: [], error: null };
            }
            
            const { data, error } = await window.supabaseClient
                .from('goals')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) {
                if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
                    console.log('Goals table does not exist, showing setup message');
                    return { data: null, error: { code: 'TABLE_NOT_FOUND', message: 'Goals table does not exist' } };
                }
            }
            
            return { data, error };
        } catch (error) {
            console.error('Get goals error:', error);
            return { data: null, error };
        }
    }
    
    async saveGoal(goalData) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }
            
            const { data, error } = await window.supabaseClient
                .from('goals')
                .insert([{
                    ...goalData,
                    user_id: userId
                }])
                .select()
                .single();
            
            return { data, error };
        } catch (error) {
            console.error('Save goal error:', error);
            return { data: null, error };
        }
    }
    
    async updateGoalData(goalId, goalData) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }
            
            const { data, error } = await window.supabaseClient
                .from('goals')
                .update({
                    ...goalData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', goalId)
                .eq('user_id', userId);
            
            return { data, error };
        } catch (error) {
            console.error('Update goal error:', error);
            return { data: null, error };
        }
    }
    
    async deleteGoalData(goalId) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }
            
            const { data, error } = await window.supabaseClient
                .from('goals')
                .delete()
                .eq('id', goalId)
                .eq('user_id', userId);
            
            return { data, error };
        } catch (error) {
            console.error('Delete goal error:', error);
            return { data: null, error };
        }
    }
    
    async getCurrentUserId() {
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            return user ? user.id : null;
        } catch (error) {
            console.error('Get user ID error:', error);
            return null;
        }
    }
    
    // Progress and Statistics
    updateProgressStats() {
        const totalGoals = this.goals.length;
        const activeGoals = this.goals.filter(g => g.status === 'active').length;
        const completedGoals = this.goals.filter(g => g.status === 'completed').length;
        const successRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
        
        document.getElementById('total-goals').textContent = totalGoals;
        document.getElementById('active-goals').textContent = activeGoals;
        document.getElementById('completed-goals').textContent = completedGoals;
        document.getElementById('success-rate').textContent = `${successRate}%`;
        
        // Create completion timeline chart
        this.createCompletionTimelineChart();
    }
    
    createCompletionTimelineChart() {
        const ctx = document.getElementById('completion-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        // Destroy existing chart if it exists
        if (this.completionChart) {
            this.completionChart.destroy();
        }
        
        // Generate timeline data
        const timelineData = this.generateCompletionTimelineData();
        
        this.completionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: [{
                    label: 'Goals Completed',
                    data: timelineData.completed,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Goals Created',
                    data: timelineData.created,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ccc'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#999'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#999'
                        }
                    }
                }
            }
        });
    }
    
    generateCompletionTimelineData() {
        if (this.goals.length === 0) {
            return { labels: [], completed: [], created: [] };
        }
        
        // Get date range from goals
        const dates = this.goals.map(goal => new Date(goal.created_at));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // Generate monthly intervals
        const labels = [];
        const completed = [];
        const created = [];
        
        const currentDate = new Date(minDate);
        currentDate.setDate(1); // Start of month
        
        while (currentDate <= maxDate) {
            const monthKey = currentDate.toISOString().substring(0, 7); // YYYY-MM
            labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
            
            // Count goals created in this month
            const createdInMonth = this.goals.filter(goal => {
                const goalDate = new Date(goal.created_at);
                return goalDate.toISOString().substring(0, 7) === monthKey;
            }).length;
            created.push(createdInMonth);
            
            // Count goals completed in this month
            const completedInMonth = this.goals.filter(goal => {
                if (goal.status !== 'completed') return false;
                const goalDate = new Date(goal.updated_at);
                return goalDate.toISOString().substring(0, 7) === monthKey;
            }).length;
            completed.push(completedInMonth);
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        return { labels, completed, created };
    }
    
    filterProgress(filter) {
        // This would filter the progress display based on the selected filter
        console.log('Filtering progress by:', filter);
        // Implementation would depend on how you want to display filtered progress
    }
    
    // Utility Methods
    formatGoalType(type) {
        const types = {
            'study-time': 'Study Time',
            'flashcards': 'Flashcards',
            'notes': 'Notes Created',
            'sessions': 'Study Sessions',
            'streak': 'Study Streak',
            'custom': 'Custom'
        };
        return types[type] || type;
    }
    
    formatStatus(status) {
        const statuses = {
            'active': 'Active',
            'completed': 'Completed',
            'paused': 'Paused',
            'cancelled': 'Cancelled'
        };
        return statuses[status] || status;
    }
    
    formatDate(dateString) {
        if (!dateString) return 'No date';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'white' : type === 'error' ? '#ff4444' : '#333'};
            color: ${type === 'success' ? 'black' : 'white'};
            padding: 15px 20px;
            border-radius: 6px;
            border: 0.2px solid #333;
            z-index: 1001;
            font-size: 0.9rem;
            animation: slideIn 2.3s ease;
            transition: transform 2.3s ease;
        `;
        
        // Add animation styles
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transition: transform 0.3s ease; transform: translateX(100%); opacity: 0; }
                    to { transition: transform 0.3s ease; transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Initialize the system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.goalSettingSystem = new GoalSettingSystem();
});
