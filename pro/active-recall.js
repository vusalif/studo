// Active Recall Flashcard System
class FlashcardSystem {
    constructor() {
        this.currentDeck = null;
        this.currentCard = null;
        this.reviewCards = [];
        this.currentCardIndex = 0;
        this.isCardFlipped = false;
        this.isInitialized = false;
        this.statisticsUpdateTimeout = null;
        
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
            
            // Load data in parallel for faster loading
            await Promise.all([
                this.loadDecks(),
                this.updateStatistics()
            ]);
            
            console.log('Flashcard system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize flashcard system:', error);
            this.showNotification('Failed to initialize system. Please refresh the page.', 'error');
            this.hideLoadingState();
        }
    }
    
    async checkDatabaseSetup() {
        try {
            // Try to query the flashcard_decks table
            const { data, error } = await window.supabaseClient
                .from('flashcard_decks')
                .select('id')
                .limit(1);
            
            if (error) {
                if (error.code === 'PGRST116' || error.message?.includes('404')) {
                    return false; // Tables don't exist
                }
                // Other errors might be network-related, assume tables exist
                return true;
            }
            
            return true; // Tables exist
        } catch (error) {
            console.log('Database setup check failed:', error);
            return false;
        }
    }
    
    showDatabaseSetupMessage() {
        const decksGrid = document.getElementById('decks-grid');
        decksGrid.innerHTML = `
            <div class="database-setup-message">
                <div class="setup-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF9500"/>
                    </svg>
                </div>
                <h3>Database Setup Required</h3>
                <p>The flashcard database tables need to be created in your Supabase project.</p>
                <div class="setup-steps">
                    <ol>
                        <li>Go to your <strong>Supabase project dashboard</strong></li>
                        <li>Navigate to the <strong>SQL Editor</strong></li>
                        <li>Copy and paste the contents of <code>flashcard-setup.sql</code></li>
                        <li>Run the SQL script</li>
                        <li>Refresh this page</li>
                    </ol>
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
        
        // Deck creation
        document.getElementById('create-deck-btn').addEventListener('click', () => this.showCreateDeckModal());
        document.getElementById('save-deck-btn').addEventListener('click', () => this.createDeck());
        document.getElementById('close-deck-modal').addEventListener('click', () => this.hideCreateDeckModal());
        document.getElementById('cancel-deck-btn').addEventListener('click', () => this.hideCreateDeckModal());
        
        // Card creation
        document.getElementById('save-card-btn').addEventListener('click', () => this.addCard());
        document.getElementById('close-card-modal').addEventListener('click', () => this.hideAddCardModal());
        document.getElementById('cancel-card-btn').addEventListener('click', () => this.hideAddCardModal());
        
        // Review functionality
        document.getElementById('start-review-btn').addEventListener('click', () => this.startReview());
        document.getElementById('flip-card-btn').addEventListener('click', () => this.flipCard());
        document.getElementById('review-deck-select').addEventListener('change', (e) => this.onDeckSelectChange(e));
        
        // Difficulty buttons
        document.querySelectorAll('.btn-difficulty').forEach(btn => {
            btn.addEventListener('click', (e) => this.rateCard(e.target.dataset.difficulty));
        });
        
        // Deck details modal
        document.getElementById('close-deck-details-modal').addEventListener('click', () => this.hideDeckDetailsModal());
        document.getElementById('start-deck-review-btn').addEventListener('click', () => this.startDeckReview());
        document.getElementById('add-card-to-deck-btn').addEventListener('click', () => this.showAddCardModal());
        document.getElementById('delete-deck-btn').addEventListener('click', () => this.deleteDeck());
        
        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
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
        if (tabName === 'stats') {
            this.updateStatistics();
        } else if (tabName === 'review') {
            this.populateReviewDeckSelect();
        } else if (tabName === 'plan') {
            this.initializePlanTab();
        }
    }
    
    // Deck Management
    async loadDecks() {
        try {
            const { data: decks, error } = await this.getDecks();
            if (error) throw error;
            
            this.renderDecks(decks || []);
        } catch (error) {
            console.error('Failed to load decks:', error);
            this.showNotification('Failed to load decks', 'error');
            // Show empty state on error
            this.renderDecks([]);
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
    
    renderDecks(decks) {
        const decksGrid = document.getElementById('decks-grid');
        
        // Clear the grid first
        decksGrid.innerHTML = '';
        
        if (decks.length === 0) {
            decksGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor"/>
                        </svg>
                    </div>
                    <h3>No decks yet</h3>
                    <p>Create your first deck to start learning</p>
                </div>
            `;
            return;
        }
        
        decksGrid.innerHTML = decks.map(deck => `
            <div class="deck-card" data-deck-id="${deck.id}">
                <div class="deck-header">
                    <h3>${this.escapeHtml(deck.name)}</h3>
                    <div class="deck-actions">
                        <button class="btn-icon" onclick="flashcardSystem.showDeckDetails('${deck.id}')" title="Deck Details">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="deck-description">${this.escapeHtml(deck.description || 'No description')}</p>
                <div class="deck-stats">
                    <span class="card-count">${deck.card_count || 0} cards</span>
                    <span class="last-reviewed">${this.formatLastReviewed(deck.last_reviewed)}</span>
                </div>
                <div class="deck-buttons">
                    <button class="btn btn-primary" onclick="flashcardSystem.startDeckReview('${deck.id}')">Review</button>
                    <button class="btn btn-secondary" onclick="flashcardSystem.showAddCardModal('${deck.id}')">Add Card</button>
                </div>
            </div>
        `).join('');
    }
    
    async createDeck() {
        if (!this.isInitialized) {
            this.showNotification('System is still initializing. Please wait.', 'info');
            return;
        }
        
        const name = document.getElementById('deck-name').value.trim();
        const description = document.getElementById('deck-description').value.trim();
        
        if (!name) {
            this.showNotification('Please enter a deck name', 'error');
            return;
        }
        
        try {
            const { data: deck, error } = await this.insertDeck({
                name,
                description,
                user_id: await this.getCurrentUserId()
            });
            
            if (error) throw error;
            
            this.hideCreateDeckModal();
            this.showNotification('Deck created successfully!', 'success');
            this.loadDecks();
            this.populateReviewDeckSelect();
            this.updateStatistics();
            
            // Clear form
            document.getElementById('deck-name').value = '';
            document.getElementById('deck-description').value = '';
        } catch (error) {
            console.error('Failed to create deck:', error);
            this.showNotification('Failed to create deck', 'error');
        }
    }
    
    async deleteDeck() {
        if (!this.isInitialized) {
            this.showNotification('System is still initializing. Please wait.', 'info');
            return;
        }
        
        if (!this.currentDeck) return;
        
        if (!confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
            return;
        }
        
        try {
            const { error } = await this.deleteDeckById(this.currentDeck.id);
            if (error) throw error;
            
            this.hideDeckDetailsModal();
            this.showNotification('Deck deleted successfully', 'success');
            this.loadDecks();
            this.populateReviewDeckSelect();
            this.updateStatistics();
        } catch (error) {
            console.error('Failed to delete deck:', error);
            this.showNotification('Failed to delete deck', 'error');
        }
    }
    
    // Card Management
    async addCard() {
        if (!this.isInitialized) {
            this.showNotification('System is still initializing. Please wait.', 'info');
            return;
        }
        
        const front = document.getElementById('card-front').value.trim();
        const back = document.getElementById('card-back').value.trim();
        const tags = document.getElementById('card-tags').value.trim();
        const deckId = this.currentDeck?.id || document.getElementById('add-card-modal').dataset.deckId;
        
        if (!front || !back) {
            this.showNotification('Please fill in both front and back of the card', 'error');
            return;
        }
        
        try {
            const { data: card, error } = await this.insertCard({
                front,
                back,
                tags,
                deck_id: deckId,
                user_id: await this.getCurrentUserId(),
                next_review: new Date().toISOString(), // Make immediately available for review
                last_reviewed: null // Mark as new card
            });
            
            if (error) throw error;
            
            this.hideAddCardModal();
            this.showNotification('Card added successfully!', 'success');
            this.loadDecks();
            this.updateStatistics();
            
            // Clear form
            document.getElementById('card-front').value = '';
            document.getElementById('card-back').value = '';
            document.getElementById('card-tags').value = '';
        } catch (error) {
            console.error('Failed to add card:', error);
            this.showNotification('Failed to add card', 'error');
        }
    }
    
    // Review System
    async startReview() {
        if (!this.isInitialized) {
            this.showNotification('System is still initializing. Please wait.', 'info');
            return;
        }
        
        const deckId = document.getElementById('review-deck-select').value;
        if (!deckId) {
            this.showNotification('Please select a deck to review', 'info');
            return;
        }
        
        console.log(`Starting review for deck: ${deckId}`);
        
        try {
            // First, let's check if there are any cards in this deck at all
            const { data: allCards, error: allError } = await window.supabaseClient
                .from('flashcards')
                .select('*')
                .eq('deck_id', deckId);
            
            console.log(`Total cards in deck: ${allCards?.length || 0}`);
            
            if (allCards && allCards.length > 0) {
                allCards.forEach((card, index) => {
                    console.log(`Card ${index + 1}: next_review=${card.next_review}, last_reviewed=${card.last_reviewed}`);
                });
            }
            
            const { data: cards, error } = await this.getCardsForReview(deckId);
            if (error) throw error;
            
            if (!cards || cards.length === 0) {
                this.showNotification('No cards available for review in this deck. Cards may have been recently reviewed.', 'info');
                return;
            }
            
            console.log(`Starting review with ${cards.length} cards`);
            
            this.currentDeck = { id: deckId };
            this.reviewCards = cards;
            this.currentCardIndex = 0;
            this.isCardFlipped = false;
            
            this.showReviewSession();
            this.displayCurrentCard();
        } catch (error) {
            console.error('Failed to start review:', error);
            this.showNotification('Failed to start review', 'error');
        }
    }
    
    async startDeckReview(deckId) {
        this.currentDeck = { id: deckId };
        document.getElementById('review-deck-select').value = deckId;
        this.switchTab('review');
        this.startReview();
    }
    
    showReviewSession() {
        const reviewSession = document.getElementById('review-session');
        const reviewControls = document.querySelector('.review-controls');
        
        if (reviewSession) {
            reviewSession.style.display = 'block';
        }
        if (reviewControls) {
            reviewControls.style.display = 'none';
        }
    }
    
    hideReviewSession() {
        const reviewSession = document.getElementById('review-session');
        const reviewControls = document.querySelector('.review-controls');
        
        if (reviewSession) {
            reviewSession.style.display = 'none';
        }
        if (reviewControls) {
            reviewControls.style.display = 'flex';
        }
        
        this.currentDeck = null;
        this.currentCard = null;
        this.reviewCards = [];
        this.currentCardIndex = 0;
    }
    
    displayCurrentCard() {
        if (this.currentCardIndex >= this.reviewCards.length) {
            this.completeReview();
            return;
        }
        
        this.currentCard = this.reviewCards[this.currentCardIndex];
        this.isCardFlipped = false;
        
        const cardFrontContent = document.getElementById('card-front-content');
        const cardBackContent = document.getElementById('card-back-content');
        const flipCardBtn = document.getElementById('flip-card-btn');
        const difficultyButtons = document.getElementById('difficulty-buttons');
        const flashcard = document.getElementById('current-card');
        const cardFront = document.querySelector('.card-front');
        
        if (cardFrontContent) {
            cardFrontContent.textContent = this.currentCard.front;
        }
        if (cardBackContent) {
            cardBackContent.textContent = this.currentCard.back;
            cardBackContent.style.display = 'none';
        }
        
        // Hide the "Show Answer" button since cards are now clickable
        if (flipCardBtn) {
            flipCardBtn.style.display = 'none';
        }
        
        if (difficultyButtons) {
            difficultyButtons.style.display = 'none';
        }
        
        // Show click hint only on the first card
        if (cardFront) {
            if (this.currentCardIndex === 0) {
                cardFront.classList.remove('hide-hint');
            } else {
                cardFront.classList.add('hide-hint');
            }
        }
        
        // Add click event listener to the flashcard for direct interaction
        if (flashcard) {
            flashcard.onclick = () => this.flipCard();
        }
        
        this.updateProgress();
    }
    
    flipCard() {
        this.isCardFlipped = !this.isCardFlipped;
        
        const cardBackContent = document.getElementById('card-back-content');
        const flipCardBtn = document.getElementById('flip-card-btn');
        const difficultyButtons = document.getElementById('difficulty-buttons');
        const flashcard = document.getElementById('current-card');
        const cardFront = document.querySelector('.card-front');
        
        if (this.isCardFlipped) {
            if (cardBackContent) cardBackContent.style.display = 'block';
            if (flipCardBtn) flipCardBtn.style.display = 'none';
            if (difficultyButtons) difficultyButtons.style.display = 'flex';
            
            // Hide the click hint when card is flipped
            if (cardFront) {
                cardFront.classList.add('hide-hint');
            }
            
            // Remove click handler when card is flipped to prevent double-flipping
            if (flashcard) {
                flashcard.onclick = null;
            }
        } else {
            if (cardBackContent) cardBackContent.style.display = 'none';
            if (flipCardBtn) flipCardBtn.style.display = 'none'; // Keep hidden
            if (difficultyButtons) difficultyButtons.style.display = 'none';
            
            // Show click hint again when card is flipped back (only for first card)
            if (cardFront && this.currentCardIndex === 0) {
                cardFront.classList.remove('hide-hint');
            }
            
            // Re-add click handler when card is flipped back
            if (flashcard) {
                flashcard.onclick = () => this.flipCard();
            }
        }
    }
    
    async rateCard(difficulty) {
        if (!this.currentCard) return;
        
        try {
            const reviewCount = this.currentCard.review_count || 0;
            const previousDifficulty = this.currentCard.difficulty || 'good';
            
            // Enhanced spaced repetition algorithm
            let intervalDays;
            
            switch (difficulty) {
                case 'again':
                    // Reset interval, start over
                    intervalDays = Math.max(1, Math.floor(reviewCount * 0.5)); // 1, 1, 2, 3, 4...
                    break;
                    
                case 'hard':
                    // Shorter intervals, more frequent reviews
                    if (reviewCount === 0) {
                        intervalDays = 2; // First time: 2 days
                    } else {
                        intervalDays = Math.max(2, Math.floor(reviewCount * 1.5)); // 2, 3, 4, 6, 9...
                    }
                    break;
                    
                case 'good':
                    // Standard spaced repetition intervals
                    if (reviewCount === 0) {
                        intervalDays = 4; // First time: 4 days
                    } else if (reviewCount === 1) {
                        intervalDays = 7; // Second time: 1 week
                    } else {
                        intervalDays = Math.floor(reviewCount * 3.5); // 7, 10, 14, 17, 21...
                    }
                    break;
                    
                case 'easy':
                    // Longer intervals, less frequent reviews
                    if (reviewCount === 0) {
                        intervalDays = 7; // First time: 1 week
                    } else if (reviewCount === 1) {
                        intervalDays = 14; // Second time: 2 weeks
                    } else {
                        intervalDays = Math.floor(reviewCount * 5); // 14, 20, 25, 30...
                    }
                    break;
                    
                default:
                    intervalDays = 7;
            }
            
            // Apply some randomization to avoid bunching
            const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
            intervalDays = Math.max(1, Math.floor(intervalDays * randomFactor));
            
            const now = new Date();
            const nextReview = new Date(now.getTime() + (intervalDays * 24 * 60 * 60 * 1000));
            
            console.log(`Rating card as ${difficulty}, review count: ${reviewCount}, next review in ${intervalDays} days: ${nextReview.toISOString()}`);
            
            // Update the card with review data
            const { error } = await this.updateCardReview(this.currentCard.id, {
                difficulty,
                next_review: nextReview.toISOString(),
                review_count: reviewCount + 1,
                last_reviewed: now.toISOString()
            });
            
            if (error) throw error;
            
            // Save review history for statistics
            const userId = await this.getCurrentUserId();
            const { error: historyError } = await window.supabaseClient
                .from('review_history')
                .insert({
                    card_id: this.currentCard.id,
                    user_id: userId,
                    difficulty: difficulty,
                    review_date: now.toISOString(),
                    response_time_ms: null // We could track this in the future
                });
            
            if (historyError) {
                console.error('Failed to save review history:', historyError);
                // Don't throw here - card update succeeded, history is just for stats
            }
            
            // Update statistics, but throttled during review sessions to avoid too many calls
            this.scheduleStatisticsUpdate();
            
            this.currentCardIndex++;
            this.displayCurrentCard();
        } catch (error) {
            console.error('Failed to update card review:', error);
            this.showNotification('Failed to update card review', 'error');
        }
    }
    
    completeReview() {
        // Cancel any pending scheduled statistics update since we're doing an immediate one
        if (this.statisticsUpdateTimeout) {
            clearTimeout(this.statisticsUpdateTimeout);
            this.statisticsUpdateTimeout = null;
        }
        
        this.showNotification('Review session completed!', 'success');
        this.hideReviewSession();
        this.updateStatistics();
    }
    
    updateProgress() {
        const current = this.currentCardIndex + 1;
        const total = this.reviewCards.length;
        const percentage = (current / total) * 100;
        
        const progressText = document.getElementById('progress-text');
        const progressFill = document.getElementById('progress-fill');
        
        if (progressText) {
            progressText.textContent = `${current} / ${total}`;
        }
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    }
    
    // Modal Management
    showCreateDeckModal() {
        document.getElementById('create-deck-modal').style.display = 'block';
    }
    
    hideCreateDeckModal() {
        document.getElementById('create-deck-modal').style.display = 'none';
    }
    
    showAddCardModal(deckId = null) {
        this.currentDeck = deckId ? { id: deckId } : this.currentDeck;
        document.getElementById('add-card-modal').dataset.deckId = deckId || '';
        document.getElementById('add-card-modal').style.display = 'block';
    }
    
    hideAddCardModal() {
        document.getElementById('add-card-modal').style.display = 'none';
        this.currentDeck = null;
    }
    
    async showDeckDetails(deckId) {
        try {
            const { data: deck, error } = await this.getDeckById(deckId);
            if (error) throw error;
            
            this.currentDeck = deck;
            
            document.getElementById('deck-details-title').textContent = deck.name;
            document.getElementById('deck-details-description').textContent = deck.description || 'No description';
            document.getElementById('deck-card-count').textContent = `${deck.card_count || 0} cards`;
            document.getElementById('deck-last-reviewed').textContent = this.formatLastReviewed(deck.last_reviewed);
            
            document.getElementById('deck-details-modal').style.display = 'block';
        } catch (error) {
            console.error('Failed to load deck details:', error);
            this.showNotification('Failed to load deck details', 'error');
        }
    }
    
    hideDeckDetailsModal() {
        document.getElementById('deck-details-modal').style.display = 'none';
        this.currentDeck = null;
    }
    
    // Utility Functions
    async populateReviewDeckSelect() {
        try {
            const { data: decks, error } = await this.getDecks();
            if (error) throw error;
            
            const select = document.getElementById('review-deck-select');
            select.innerHTML = '<option value="">Select a deck to review</option>';
            
            (decks || []).forEach(deck => {
                const option = document.createElement('option');
                option.value = deck.id;
                option.textContent = deck.name;
                select.appendChild(option);
            });
            
            document.getElementById('start-review-btn').disabled = !decks || decks.length === 0;
        } catch (error) {
            console.error('Failed to populate review deck select:', error);
        }
    }
    
    onDeckSelectChange(event) {
        document.getElementById('start-review-btn').disabled = !event.target.value;
    }
    
    async updateStatistics() {
        try {
            console.log('🔄 Updating statistics...');
            const { data: stats, error } = await this.getDetailedStatistics();
            
            if (error) {
                console.error('❌ Error getting detailed statistics:', error);
                throw error;
            }
            
            console.log('📊 Statistics data received:', stats);
            
            if (!stats) {
                console.warn('⚠️ No statistics data returned');
                return;
            }
            
            // Update basic stats
            this.updateBasicStats(stats);
            
            // Update detailed metrics
            this.updateDetailedMetrics(stats);
            
            // Create/update charts
            this.createCharts(stats);
            
            console.log('✅ Statistics updated successfully');
            
        } catch (error) {
            console.error('❌ Failed to update statistics:', error);
            this.showNotification('Failed to load statistics', 'error');
        }
    }
    
    updateBasicStats(stats) {
        // Basic overview stats
        const elements = {
            'total-cards': stats.totalCards || 0,
            'cards-due': stats.cardsDue || 0,
            'current-streak': stats.currentStreak || 0,
            'reviews-today': stats.reviewsToday || 0,
            'mastered-cards-stat': stats.masteredCards || 0
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Success rate with description
        const successRateEl = document.getElementById('success-rate');
        const successRateDesc = document.getElementById('success-rate-desc');
        if (successRateEl) {
            successRateEl.textContent = `${stats.successRate || 0}%`;
        }
        if (successRateDesc) {
            if (stats.totalReviews > 0) {
                successRateDesc.textContent = `${stats.totalReviews} reviews`;
            } else {
                successRateDesc.textContent = 'No reviews yet';
            }
        }
    }
    
    updateDetailedMetrics(stats) {
        // Progress bars
        const masteredProgress = document.getElementById('mastered-progress');
        const masteredCount = document.getElementById('mastered-count');
        if (masteredProgress && masteredCount) {
            const masteredPercentage = stats.totalCards > 0 ? 
                (stats.masteredCards / stats.totalCards) * 100 : 0;
            masteredProgress.style.width = `${masteredPercentage}%`;
            masteredCount.textContent = `${stats.masteredCards || 0} / ${stats.totalCards || 0}`;
        }
        
        // Velocity
        const velocityValue = document.getElementById('velocity-value');
        if (velocityValue) {
            velocityValue.textContent = stats.learningVelocity || 0;
        }
        
        // Review statistics
        const reviewStats = {
            'total-reviews': stats.totalReviews || 0,
            'avg-daily-reviews': stats.avgDailyReviews || 0,
            'longest-streak': stats.longestStreak || 0,
            'accuracy-rate': `${stats.accuracyRate || 0}%`
        };
        
        Object.entries(reviewStats).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
    
    // Throttled statistics update to avoid too many database calls during review sessions
    scheduleStatisticsUpdate() {
        // Clear any existing timeout
        if (this.statisticsUpdateTimeout) {
            clearTimeout(this.statisticsUpdateTimeout);
        }
        
        // Schedule update after a short delay (500ms)
        // This will batch multiple rapid calls into a single update
        this.statisticsUpdateTimeout = setTimeout(() => {
            this.updateStatistics();
            this.statisticsUpdateTimeout = null;
        }, 500);
    }
    
    // Chart Creation Methods
    createCharts(stats) {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js library not loaded');
            return;
        }
        
        this.createPerformanceChart(stats.performanceData);
        this.createDifficultyChart(stats.difficultyDistribution);
        this.createActivityChart(stats.dailyActivity);
        this.createDeckPerformanceChart(stats.deckPerformance);
    }
    
    createPerformanceChart(performanceData) {
        const ctx = document.getElementById('performance-chart');
        if (!ctx || !performanceData) return;
        
        // Destroy existing chart if it exists
        if (this.performanceChart) {
            this.performanceChart.destroy();
        }
        
        this.performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: performanceData.labels || [],
                datasets: [{
                    label: 'Success Rate %',
                    data: performanceData.successRates || [],
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
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
    
    createDifficultyChart(difficultyData) {
        const ctx = document.getElementById('difficulty-chart');
        if (!ctx || !difficultyData) return;
        
        if (this.difficultyChart) {
            this.difficultyChart.destroy();
        }
        
        this.difficultyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Again', 'Hard', 'Good', 'Easy'],
                datasets: [{
                    data: [
                        difficultyData.again || 0,
                        difficultyData.hard || 0,
                        difficultyData.good || 0,
                        difficultyData.easy || 0
                    ],
                    backgroundColor: [
                        '#f44336',
                        '#ff9800', 
                        '#4CAF50',
                        '#2196F3'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ccc',
                            padding: 15
                        }
                    }
                }
            }
        });
    }
    
    createActivityChart(activityData) {
        const ctx = document.getElementById('activity-chart');
        if (!ctx || !activityData) return;
        
        if (this.activityChart) {
            this.activityChart.destroy();
        }
        
        this.activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: activityData.labels || [],
                datasets: [{
                    label: 'Reviews',
                    data: activityData.reviews || [],
                    backgroundColor: 'rgba(0, 122, 255, 0.6)',
                    borderColor: '#007AFF',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
    
    createDeckPerformanceChart(deckData) {
        const ctx = document.getElementById('deck-performance-chart');
        if (!ctx || !deckData) return;
        
        if (this.deckPerformanceChart) {
            this.deckPerformanceChart.destroy();
        }
        
        this.deckPerformanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: deckData.names || [],
                datasets: [{
                    label: 'Success Rate %',
                    data: deckData.successRates || [],
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: '#4CAF50',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#999'
                        }
                    },
                    y: {
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
    
    // Database Functions
    async getDecks() {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            const { data, error } = await window.supabaseClient
                .from('flashcard_decks')
                .select('*')
                .eq('user_id', await this.getCurrentUserId())
                .order('created_at', { ascending: false });
            
            if (error) {
                // Handle specific error cases
                if (error.code === 'PGRST116' || error.message?.includes('404')) {
                    throw new Error('Database tables not found. Please run the flashcard-setup.sql script in your Supabase project.');
                }
                throw error;
            }
            return { data, error: null };
        } catch (error) {
            console.error('Get decks error:', error);
            
            // Show user-friendly error message
            if (error.message?.includes('Database tables not found')) {
                this.showNotification('Database not set up. Please run the setup script.', 'error');
            } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                this.showNotification('Connection error. Please check your internet connection.', 'error');
            }
            
            return { data: null, error };
        }
    }
    
    async getDeckById(deckId) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            const { data, error } = await window.supabaseClient
                .from('flashcard_decks')
                .select('*')
                .eq('id', deckId)
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Get deck error:', error);
            return { data: null, error };
        }
    }
    
    async insertDeck(deckData) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            const { data, error } = await window.supabaseClient
                .from('flashcard_decks')
                .insert([deckData])
                .select()
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Insert deck error:', error);
            return { data: null, error };
        }
    }
    
    async deleteDeckById(deckId) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            // First delete all cards in the deck
            const { error: cardsError } = await window.supabaseClient
                .from('flashcards')
                .delete()
                .eq('deck_id', deckId);
            
            if (cardsError) throw cardsError;
            
            // Then delete the deck
            const { error } = await window.supabaseClient
                .from('flashcard_decks')
                .delete()
                .eq('id', deckId);
            
            if (error) throw error;
            return { error: null };
        } catch (error) {
            console.error('Delete deck error:', error);
            return { error };
        }
    }
    
    async insertCard(cardData) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            const { data, error } = await window.supabaseClient
                .from('flashcards')
                .insert([cardData])
                .select()
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Insert card error:', error);
            return { data: null, error };
        }
    }
    
    async getCardsForReview(deckId) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            // Get current time plus a small buffer to catch cards that should be due now
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1); // Add 1 minute buffer
            
            const { data, error } = await window.supabaseClient
                .from('flashcards')
                .select('*')
                .eq('deck_id', deckId)
                .lte('next_review', now.toISOString())
                .order('next_review', { ascending: true });
            
            if (error) throw error;
            
            console.log(`Found ${data?.length || 0} cards for review in deck ${deckId}`);
            
            // If no cards found with time buffer, get all cards from the deck for new cards
            if (!data || data.length === 0) {
                console.log('No cards due, checking for new cards...');
                const { data: allCards, error: allError } = await window.supabaseClient
                    .from('flashcards')
                    .select('*')
                    .eq('deck_id', deckId)
                    .is('last_reviewed', null)
                    .order('created_at', { ascending: true });
                
                if (allError) throw allError;
                console.log(`Found ${allCards?.length || 0} new cards to review`);
                
                // If still no cards, let's be more lenient and get all cards for review
                if (!allCards || allCards.length === 0) {
                    console.log('No new cards either, getting all cards in deck for review...');
                    const { data: allDeckCards, error: allDeckError } = await window.supabaseClient
                        .from('flashcards')
                        .select('*')
                        .eq('deck_id', deckId)
                        .order('created_at', { ascending: true });
                    
                    if (allDeckError) throw allDeckError;
                    console.log(`Found ${allDeckCards?.length || 0} total cards in deck - making them all available for review`);
                    return { data: allDeckCards, error: null };
                }
                
                return { data: allCards, error: null };
            }
            
            return { data, error: null };
        } catch (error) {
            console.error('Get cards for review error:', error);
            return { data: null, error };
        }
    }
    
    async updateCardReview(cardId, reviewData) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }
            
            const { data, error } = await window.supabaseClient
                .from('flashcards')
                .update(reviewData)
                .eq('id', cardId)
                .select()
                .single();
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Update card review error:', error);
            return { data: null, error };
        }
    }
    
    async getDetailedStatistics() {
        try {
            console.log('🔍 Getting detailed statistics...');
            
            if (!window.supabaseClient) {
                console.error('❌ Supabase client not available');
                throw new Error('Supabase client not available');
            }
            
            const userId = await this.getCurrentUserId();
            console.log('👤 User ID:', userId);
            
            if (!userId) {
                console.error('❌ No user ID found');
                throw new Error('User not authenticated');
            }
            
            // Get all review history with timestamps
            console.log('📚 Fetching review history...');
            const { data: reviewHistory, error: reviewError } = await window.supabaseClient
                .from('review_history')
                .select('*')
                .eq('user_id', userId)
                .order('review_date', { ascending: true });
            
            if (reviewError) {
                console.error('❌ Review history error:', reviewError);
                throw reviewError;
            }
            console.log('📚 Review history:', reviewHistory?.length || 0, 'records');
            
            // Get total cards
            console.log('🃏 Fetching total cards...');
            const { data: totalCards, error: totalError } = await window.supabaseClient
                .from('flashcards')
                .select('*')
                .eq('user_id', userId);
            
            if (totalError) {
                console.error('❌ Total cards error:', totalError);
                throw totalError;
            }
            console.log('🃏 Total cards:', totalCards?.length || 0);
            
            // If no review history but we have reviewed cards, create placeholder history
            if ((!reviewHistory || reviewHistory.length === 0) && totalCards?.some(card => card.last_reviewed)) {
                console.log('🔄 Creating placeholder review history for reviewed cards...');
                await this.createPlaceholderReviewHistory(totalCards, userId);
                // Re-fetch review history
                const { data: newReviewHistory } = await window.supabaseClient
                    .from('review_history')
                    .select('*')
                    .eq('user_id', userId)
                    .order('review_date', { ascending: true });
                reviewHistory = newReviewHistory || [];
                console.log('📚 Updated review history:', reviewHistory.length, 'records');
            }
            
            // Get cards due for review
            console.log('⏰ Fetching cards due...');
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            
            const { data: cardsDue, error: dueError } = await window.supabaseClient
                .from('flashcards')
                .select('id', { count: 'exact' })
                .eq('user_id', userId)
                .or(`next_review.lte.${now.toISOString()},last_reviewed.is.null`);
            
            if (dueError) {
                console.error('❌ Cards due error:', dueError);
                throw dueError;
            }
            console.log('⏰ Cards due:', cardsDue?.length || 0);
            
            // Get deck information
            console.log('📦 Fetching decks...');
            const { data: decks, error: deckError } = await window.supabaseClient
                .from('flashcard_decks')
                .select('*')
                .eq('user_id', userId);
            
            if (deckError) {
                console.error('❌ Decks error:', deckError);
                throw deckError;
            }
            console.log('📦 Decks:', decks?.length || 0);
            
            // Process statistics
            console.log('⚙️ Processing statistics...');
            const stats = this.processDetailedStatistics(
                reviewHistory || [], 
                totalCards || [], 
                cardsDue || [], 
                decks || []
            );
            
            console.log('📊 Processed statistics:', stats);
            
            return {
                data: stats,
                error: null
            };
        } catch (error) {
            console.error('❌ Get detailed statistics error:', error);
            return { data: null, error };
        }
    }
    
    processDetailedStatistics(reviewHistory, totalCards, cardsDue, decks) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Basic statistics
        const totalReviews = reviewHistory.length;
        const successfulReviews = reviewHistory.filter(r => 
            r.difficulty === 'good' || r.difficulty === 'easy'
        ).length;
        const successRate = totalReviews > 0 ? Math.round((successfulReviews / totalReviews) * 100) : 0;
        
        // Reviews today
        const reviewsToday = reviewHistory.filter(r => {
            const reviewDate = new Date(r.review_date);
            return reviewDate >= today;
        }).length;
        
        // Note: Average response time calculation removed - no longer displayed
        
        // Mastered cards (cards reviewed successfully multiple times)
        const cardReviewCounts = {};
        reviewHistory.forEach(r => {
            if (!cardReviewCounts[r.card_id]) cardReviewCounts[r.card_id] = { total: 0, successful: 0 };
            cardReviewCounts[r.card_id].total++;
            if (r.difficulty === 'good' || r.difficulty === 'easy') {
                cardReviewCounts[r.card_id].successful++;
            }
        });
        
        const masteredCards = Object.values(cardReviewCounts).filter(c => 
            c.total >= 3 && c.successful >= 2
        ).length;
        
        // Learning velocity (cards learned per day)
        const firstReview = reviewHistory.length > 0 ? new Date(reviewHistory[0].review_date) : now;
        const daysSinceFirst = Math.max(1, Math.floor((now - firstReview) / (1000 * 60 * 60 * 24)));
        const learningVelocity = Math.round(totalReviews / daysSinceFirst * 10) / 10;
        
        // Daily activity data (last 7 days)
        const dailyActivity = this.generateDailyActivity(reviewHistory, 7);
        
        // Performance over time
        const performanceData = this.generatePerformanceData(reviewHistory);
        
        // Difficulty distribution
        const difficultyDistribution = {
            again: reviewHistory.filter(r => r.difficulty === 'again').length,
            hard: reviewHistory.filter(r => r.difficulty === 'hard').length,
            good: reviewHistory.filter(r => r.difficulty === 'good').length,
            easy: reviewHistory.filter(r => r.difficulty === 'easy').length
        };
        
        // Deck performance
        const deckPerformance = this.generateDeckPerformance(reviewHistory, decks, totalCards);
        
        // Streak calculation (consecutive days with reviews)
        const { currentStreak, longestStreak } = this.calculateStreaks(reviewHistory);
        
        // Average daily reviews
        const avgDailyReviews = daysSinceFirst > 0 ? Math.round(totalReviews / daysSinceFirst) : 0;
        
        return {
            // Basic stats
            totalCards: totalCards.length,
            cardsDue: cardsDue.length,
            currentStreak,
            successRate,
            reviewsToday,
            
            // Detailed metrics
            masteredCards,
            learningVelocity,
            totalReviews,
            avgDailyReviews,
            longestStreak,
            accuracyRate: successRate, // Same as success rate for now
            
            // Chart data
            performanceData,
            difficultyDistribution,
            dailyActivity,
            deckPerformance
        };
    }
    
    generateDailyActivity(reviewHistory, days) {
        const labels = [];
        const reviews = [];
        const now = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            labels.push(dateStr);
            
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            
            const dayReviews = reviewHistory.filter(r => {
                const reviewDate = new Date(r.review_date);
                return reviewDate >= dayStart && reviewDate < dayEnd;
            }).length;
            
            reviews.push(dayReviews);
        }
        
        return { labels, reviews };
    }
    
    generatePerformanceData(reviewHistory) {
        if (reviewHistory.length === 0) {
            return { labels: [], successRates: [] };
        }
        
        // Group reviews by week
        const weeklyData = {};
        reviewHistory.forEach(review => {
            const reviewDate = new Date(review.review_date);
            const weekStart = new Date(reviewDate);
            weekStart.setDate(reviewDate.getDate() - reviewDate.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { total: 0, successful: 0 };
            }
            weeklyData[weekKey].total++;
            if (review.difficulty === 'good' || review.difficulty === 'easy') {
                weeklyData[weekKey].successful++;
            }
        });
        
        const labels = [];
        const successRates = [];
        
        // Sort weeks and ensure we have at least some data points
        const sortedWeeks = Object.keys(weeklyData).sort();
        
        // If we have very few data points, create more granular data (daily instead of weekly)
        if (sortedWeeks.length < 3) {
            return this.generateDailyPerformanceData(reviewHistory);
        }
        
        sortedWeeks.forEach(week => {
            const date = new Date(week);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const rate = weeklyData[week].total > 0 
                ? Math.round((weeklyData[week].successful / weeklyData[week].total) * 100)
                : 0;
            successRates.push(rate);
        });
        
        return { labels, successRates };
    }
    
    generateDailyPerformanceData(reviewHistory) {
        // Group reviews by day for more granular data when we have few reviews
        const dailyData = {};
        reviewHistory.forEach(review => {
            const reviewDate = new Date(review.review_date);
            const dayKey = reviewDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            if (!dailyData[dayKey]) {
                dailyData[dayKey] = { total: 0, successful: 0 };
            }
            
            dailyData[dayKey].total++;
            if (review.difficulty === 'good' || review.difficulty === 'easy') {
                dailyData[dayKey].successful++;
            }
        });
        
        const labels = [];
        const successRates = [];
        
        Object.keys(dailyData).sort().forEach(day => {
            const date = new Date(day);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            const rate = dailyData[day].total > 0 
                ? Math.round((dailyData[day].successful / dailyData[day].total) * 100)
                : 0;
            successRates.push(rate);
        });
        
        return { labels, successRates };
    }
    
    generateDeckPerformance(reviewHistory, decks, totalCards) {
        const deckStats = {};
        
        // Group reviews by deck
        reviewHistory.forEach(review => {
            const card = totalCards?.find(c => c.id === review.card_id);
            if (card) {
                const deckId = card.deck_id;
                if (!deckStats[deckId]) {
                    deckStats[deckId] = { total: 0, successful: 0 };
                }
                deckStats[deckId].total++;
                if (review.difficulty === 'good' || review.difficulty === 'easy') {
                    deckStats[deckId].successful++;
                }
            }
        });
        
        const names = [];
        const successRates = [];
        
        decks.forEach(deck => {
            if (deckStats[deck.id] && deckStats[deck.id].total > 0) {
                names.push(deck.name.length > 15 ? deck.name.substring(0, 15) + '...' : deck.name);
                const rate = Math.round((deckStats[deck.id].successful / deckStats[deck.id].total) * 100);
                successRates.push(rate);
            }
        });
        
        return { names, successRates };
    }
    
    calculateStreaks(reviewHistory) {
        if (reviewHistory.length === 0) {
            return { currentStreak: 0, longestStreak: 0 };
        }
        
        // Get unique review dates
        const reviewDates = [...new Set(reviewHistory.map(r => {
            const date = new Date(r.review_date);
            return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        }))].sort((a, b) => b - a); // Most recent first
        
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        
        const today = new Date();
        const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const yesterdayTime = todayTime - 24 * 60 * 60 * 1000;
        
        // Calculate current streak
        if (reviewDates.includes(todayTime)) {
            currentStreak = 1;
            let checkDate = yesterdayTime;
            for (let i = 1; i < reviewDates.length; i++) {
                if (reviewDates[i] === checkDate) {
                    currentStreak++;
                    checkDate -= 24 * 60 * 60 * 1000;
                } else {
                    break;
                }
            }
        } else if (reviewDates.includes(yesterdayTime)) {
            currentStreak = 1;
            let checkDate = yesterdayTime - 24 * 60 * 60 * 1000;
            for (let i = 1; i < reviewDates.length; i++) {
                if (reviewDates[i] === checkDate) {
                    currentStreak++;
                    checkDate -= 24 * 60 * 60 * 1000;
                } else {
                    break;
                }
            }
        }
        
        // Calculate longest streak
        tempStreak = 1;
        longestStreak = 1;
        
        for (let i = 1; i < reviewDates.length; i++) {
            if (reviewDates[i-1] - reviewDates[i] === 24 * 60 * 60 * 1000) {
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        
        return { currentStreak, longestStreak };
    }
    
    // Create placeholder review history for existing reviewed cards
    async createPlaceholderReviewHistory(totalCards, userId) {
        try {
            const reviewedCards = totalCards.filter(card => card.last_reviewed);
            const historyRecords = [];
            
            reviewedCards.forEach(card => {
                // Create a placeholder review history record based on card's current state
                const reviewDate = card.last_reviewed || new Date().toISOString();
                historyRecords.push({
                    card_id: card.id,
                    user_id: userId,
                    difficulty: card.difficulty || 'good',
                    review_date: reviewDate,
                    response_time_ms: null
                });
            });
            
            if (historyRecords.length > 0) {
                const { error } = await window.supabaseClient
                    .from('review_history')
                    .insert(historyRecords);
                
                if (error) {
                    console.error('Failed to create placeholder review history:', error);
                } else {
                    console.log(`✅ Created ${historyRecords.length} placeholder review history records`);
                }
            }
        } catch (error) {
            console.error('Error creating placeholder review history:', error);
        }
    }
    
    async getCurrentUserId() {
        try {
            // Try to get from Supabase auth first
            if (window.supabaseClient && window.supabaseClient.auth) {
                try {
                    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
                    if (!error && user && user.id) {
                        return user.id;
                    }
                } catch (authError) {
                    console.log('Auth error, falling back to localStorage:', authError.message);
                }
            }
            
            // Try to get from localStorage as fallback
            const userId = localStorage.getItem('userId');
            if (userId) {
                return userId;
            }
            
            // If no user ID is available, use a default for testing
            // In production, you should redirect to login
            console.warn('No user ID available, using default for testing');
            return 'test-user-id';
            
        } catch (error) {
            console.error('Error getting user ID:', error);
            // Fallback to localStorage
            const userId = localStorage.getItem('userId');
            if (userId) {
                return userId;
            }
            return 'test-user-id';
        }
    }
    
    // Helper Functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatLastReviewed(dateString) {
        if (!dateString) return 'Never reviewed';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }
    
    // Plan Tab Calendar Functions
    initializePlanTab() {
        this.currentCalendarDate = new Date();
        this.selectedDate = null;
        this.setupCalendarEventListeners();
        this.renderCalendar();
        this.loadKnowledgeOverview();
    }
    
    setupCalendarEventListeners() {
        // Month navigation
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
            this.renderCalendar();
        });
        
        document.getElementById('next-month').addEventListener('click', () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
            this.renderCalendar();
        });
        
        // Year navigation
        document.getElementById('prev-year').addEventListener('click', () => {
            this.currentCalendarDate.setFullYear(this.currentCalendarDate.getFullYear() - 1);
            this.renderCalendar();
        });
        
        document.getElementById('next-year').addEventListener('click', () => {
            this.currentCalendarDate.setFullYear(this.currentCalendarDate.getFullYear() + 1);
            this.renderCalendar();
        });
    }
    
    async renderCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        const calendarTitle = document.getElementById('calendar-title');
        
        if (!calendarGrid || !calendarTitle) return;
        
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        // Update title
        calendarTitle.textContent = new Date(year, month).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        // Get due dates data for current month AND adjacent months for proper display
        const prevMonthData = await this.getDueDatesForMonth(year, month - 1);
        const currentMonthData = await this.getDueDatesForMonth(year, month);
        const nextMonthData = await this.getDueDatesForMonth(year, month + 1);
        
        // Combine all due dates data
        const allDueDatesData = { ...prevMonthData, ...currentMonthData, ...nextMonthData };
        
        // Clear calendar
        calendarGrid.innerHTML = '';
        
        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // Calculate calendar layout
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Calculate previous month info
        const prevMonthYear = month === 0 ? year - 1 : year;
        const prevMonthIndex = month === 0 ? 11 : month - 1;
        const prevMonthLastDay = new Date(prevMonthYear, prevMonthIndex + 1, 0).getDate();
        
        // Calculate next month info
        const nextMonthYear = month === 11 ? year + 1 : year;
        const nextMonthIndex = month === 11 ? 0 : month + 1;
        
        // Add previous month's trailing days
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const dayElement = this.createCalendarDay(day, true, prevMonthYear, prevMonthIndex, allDueDatesData);
            calendarGrid.appendChild(dayElement);
        }
        
        // Add current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = this.createCalendarDay(day, false, year, month, allDueDatesData);
            calendarGrid.appendChild(dayElement);
        }
        
        // Add next month's leading days to fill the grid (6 rows × 7 days = 42 cells)
        const totalCells = 42;
        const cellsUsed = startingDayOfWeek + daysInMonth;
        const remainingCells = totalCells - cellsUsed;
        
        for (let day = 1; day <= remainingCells; day++) {
            const dayElement = this.createCalendarDay(day, true, nextMonthYear, nextMonthIndex, allDueDatesData);
            calendarGrid.appendChild(dayElement);
        }
    }
    
    createCalendarDay(day, isOtherMonth, year, month, dueDatesData) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const today = new Date().toISOString().split('T')[0];
        
        if (dateStr === today && !isOtherMonth) {
            dayElement.classList.add('today');
        }
        
        // Add due date highlighting
        if (dueDatesData[dateStr] && !isOtherMonth) {
            const cardCount = dueDatesData[dateStr].count;
            const daysFromToday = this.getDaysFromToday(new Date(dateStr));
            
            if (daysFromToday === 0) {
                dayElement.classList.add('due-today');
            } else if (daysFromToday <= 7) {
                dayElement.classList.add('due-soon');
            } else {
                dayElement.classList.add('due-later');
            }
            
            // Add card count indicator
            const countElement = document.createElement('div');
            countElement.className = 'calendar-day-count';
            countElement.textContent = cardCount;
            dayElement.appendChild(countElement);
        }
        
        // Add click event
        dayElement.addEventListener('click', () => {
            if (!isOtherMonth) {
                this.selectDate(new Date(year, month, day));
            }
        });
        
        return dayElement;
    }
    
    async getDueDatesForMonth(year, month) {
        try {
            // Handle year boundaries properly
            let actualYear = year;
            let actualMonth = month;
            
            if (month < 0) {
                actualYear = year - 1;
                actualMonth = 11;
            } else if (month > 11) {
                actualYear = year + 1;
                actualMonth = 0;
            }
            
            const startDate = new Date(actualYear, actualMonth, 1);
            const endDate = new Date(actualYear, actualMonth + 1, 0);
            
            // Set time to include full days
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            const { data: cards, error } = await window.supabaseClient
                .from('flashcards')
                .select('next_review, id')
                .eq('user_id', await this.getCurrentUserId())
                .gte('next_review', startDate.toISOString())
                .lte('next_review', endDate.toISOString());
            
            if (error) throw error;
            
            const dueDates = {};
            cards?.forEach(card => {
                const date = card.next_review.split('T')[0];
                if (!dueDates[date]) {
                    dueDates[date] = { count: 0, cards: [] };
                }
                dueDates[date].count++;
                dueDates[date].cards.push(card);
            });
            
            return dueDates;
        } catch (error) {
            console.error('Failed to get due dates:', error);
            return {};
        }
    }
    
    getDaysFromToday(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    }
    
    selectDate(date) {
        // Remove previous selection
        document.querySelectorAll('.calendar-day.selected').forEach(day => {
            day.classList.remove('selected');
        });
        
        // Add selection to clicked day (need to find the element properly)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const calendarDays = document.querySelectorAll('.calendar-day:not(.other-month)');
        calendarDays.forEach(dayElement => {
            if (dayElement.textContent.trim() === String(date.getDate())) {
                dayElement.classList.add('selected');
            }
        });
        
        this.selectedDate = date;
        this.showDateInfo(date);
    }
    
    async showDateInfo(date) {
        const dateInfo = document.getElementById('date-info');
        const selectedDateTitle = document.getElementById('selected-date-title');
        const dateCards = document.getElementById('date-cards');
        
        if (!dateInfo || !selectedDateTitle || !dateCards) return;
        
        selectedDateTitle.textContent = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        try {
            // Format date properly for comparison
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            console.log('Searching for cards on date:', dateStr);
            
            const { data: cards, error } = await window.supabaseClient
                .from('flashcards')
                .select(`
                    *,
                    flashcard_decks!inner(name)
                `)
                .eq('user_id', await this.getCurrentUserId())
                .gte('next_review', `${dateStr}T00:00:00.000Z`)
                .lte('next_review', `${dateStr}T23:59:59.999Z`);
            
            console.log('Found cards:', cards?.length || 0);
            
            if (error) throw error;
            
            if (!cards || cards.length === 0) {
                dateCards.innerHTML = '<p style="color: #666; text-align: center;">No cards due on this date</p>';
            } else {
                dateCards.innerHTML = cards.map(card => `
                    <div class="date-card-item">
                        <div class="card-deck-name">${this.escapeHtml(card.flashcard_decks.name)}</div>
                        <div class="card-content-preview">${this.escapeHtml(card.front.substring(0, 100))}${card.front.length > 100 ? '...' : ''}</div>
                    </div>
                `).join('');
            }
            
            dateInfo.style.display = 'block';
        } catch (error) {
            console.error('Failed to load date info:', error);
            dateCards.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Error loading cards for this date</p>';
            dateInfo.style.display = 'block';
        }
    }
    
    async loadKnowledgeOverview() {
        try {
            const deckKnowledgeList = document.getElementById('deck-knowledge-list');
            if (!deckKnowledgeList) return;
            
            const { data: decks, error } = await this.getDecks();
            if (error) throw error;
            
            if (!decks || decks.length === 0) {
                deckKnowledgeList.innerHTML = '<p style="color: #666; text-align: center;">No decks available</p>';
                return;
            }
            
            // Get detailed stats for each deck
            const deckStats = await Promise.all(decks.map(async deck => {
                const { data: cards, error: cardsError } = await window.supabaseClient
                    .from('flashcards')
                    .select('review_count, difficulty, last_reviewed')
                    .eq('deck_id', deck.id);
                
                if (cardsError) return { ...deck, totalCards: 0, knowledgeLevel: 0, masteryLevel: 'Error' };
                
                const totalCards = cards?.length || 0;
                
                // Calculate performance-based knowledge score
                let totalScore = 0;
                let reviewedCards = 0;
                
                cards?.forEach(card => {
                    if (card.last_reviewed) {
                        reviewedCards++;
                        
                        // Score based on last difficulty rating and review count
                        let cardScore = 0;
                        const reviewCount = card.review_count || 0;
                        
                        switch (card.difficulty) {
                            case 'again':
                                // Very low mastery - needs immediate review
                                cardScore = Math.min(20, reviewCount * 5); // Max 20% for 'again'
                                break;
                            case 'hard':
                                // Low mastery - struggling with the card
                                cardScore = Math.min(50, 25 + (reviewCount * 8)); // 25-50% range
                                break;
                            case 'good':
                                // Good mastery - comfortable with the card
                                cardScore = Math.min(85, 50 + (reviewCount * 10)); // 50-85% range
                                break;
                            case 'easy':
                                // High mastery - very comfortable
                                cardScore = Math.min(100, 70 + (reviewCount * 15)); // 70-100% range
                                break;
                            default:
                                // First review or no difficulty set
                                cardScore = Math.min(30, reviewCount * 10); // Conservative default
                        }
                        
                        totalScore += cardScore;
                    }
                });
                
                // Calculate overall deck knowledge percentage
                const knowledgeLevel = totalCards > 0 ? 
                    Math.round(totalScore / totalCards) : 0;
                
                // Determine mastery level for display
                let masteryLevel = 'Not Started';
                
                if (reviewedCards === 0) {
                    masteryLevel = 'Not Started';
                } else if (knowledgeLevel < 30) {
                    masteryLevel = 'Learning';
                } else if (knowledgeLevel < 60) {
                    masteryLevel = 'Developing';
                } else if (knowledgeLevel < 85) {
                    masteryLevel = 'Proficient';
                } else {
                    masteryLevel = 'Mastered';
                }
                
                return {
                    ...deck,
                    totalCards,
                    reviewedCards,
                    knowledgeLevel,
                    masteryLevel
                };
            }));
            
            deckKnowledgeList.innerHTML = deckStats.map(deck => {
                // Determine mastery class for styling
                let masteryClass = 'not-started';
                if (deck.masteryLevel === 'Learning') masteryClass = 'learning';
                else if (deck.masteryLevel === 'Developing') masteryClass = 'developing';
                else if (deck.masteryLevel === 'Proficient') masteryClass = 'proficient';
                else if (deck.masteryLevel === 'Mastered') masteryClass = 'mastered';
                
                return `
                    <div class="deck-knowledge-item">
                        <div class="deck-info">
                            <div class="deck-name">${this.escapeHtml(deck.name)}</div>
                            <div class="deck-progress">
                                <span>${deck.reviewedCards}/${deck.totalCards} cards reviewed</span>
                                <span class="mastery-level ${masteryClass}">${deck.masteryLevel}</span>
                            </div>
                        </div>
                        <div class="knowledge-bar">
                            <div class="knowledge-fill ${masteryClass}" style="width: ${deck.knowledgeLevel}%"></div>
                            <span class="knowledge-percentage">${deck.knowledgeLevel}%</span>
                        </div>
                        <div class="deck-stats-mini">
                            <span>Due: ${deck.card_count || 0}</span>
                            <span>Last: ${this.formatLastReviewed(deck.last_reviewed)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load knowledge overview:', error);
        }
    }
    
    // Helper function to reset all cards for testing
    async resetAllCardsForReview() {
        try {
            const userId = await this.getCurrentUserId();
            const { error } = await window.supabaseClient
                .from('flashcards')
                .update({
                    next_review: new Date().toISOString(),
                    last_reviewed: null,
                    review_count: 0,
                    difficulty: 'good'
                })
                .eq('user_id', userId);
            
            if (error) throw error;
            
            this.showNotification('All cards reset for review!', 'success');
            this.loadDecks();
            this.updateStatistics();
            
            // Refresh calendar if in plan tab
            if (document.getElementById('plan-tab').classList.contains('active')) {
                this.renderCalendar();
                this.loadKnowledgeOverview();
            }
        } catch (error) {
            console.error('Failed to reset cards:', error);
            this.showNotification('Failed to reset cards', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize the flashcard system when the page loads
let flashcardSystem;
document.addEventListener('DOMContentLoaded', () => {
    flashcardSystem = new FlashcardSystem();
    // Make it globally available for onclick handlers
    window.flashcardSystem = flashcardSystem;
});
