// Blurting Page JavaScript
class BlurtingApp {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.isEditing = false;
        
        this.init();
    }
    
    async init() {
        // Initialize Supabase
        await this.initializeSupabase();
        
        // Load notes
        await this.loadNotes();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render notes
        this.renderNotes();
    }
    
    async initializeSupabase() {
        try {
            // Wait for Supabase to be available
            let attempts = 0;
            while (typeof supabase === 'undefined' && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (typeof supabase !== 'undefined') {
                console.log('Supabase initialized successfully');
                
                // Check if user is authenticated
                try {
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user) {
                        console.log('User authenticated:', user.email);
                        this.showNotification('Connected to cloud database', 'success');
                    } else {
                        console.log('No authenticated user');
                        this.showNotification('Please sign in to sync notes to the cloud', 'info');
                    }
                } catch (authError) {
                    console.log('Auth check failed:', authError);
                }
            } else {
                console.error('Supabase failed to load');
            }
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        }
    }
    
    async loadNotes() {
        try {
            // Try to load from localStorage first
            const storedNotes = localStorage.getItem('blurting_notes');
            this.notes = storedNotes ? JSON.parse(storedNotes) : [];
            
            // If Supabase is available, try to sync
            if (typeof supabase !== 'undefined' && window.supabaseClient) {
                try {
                    const { data, error } = await window.supabaseClient
                        .from('blurting_notes')
                        .select('*')
                        .order('created_at', { ascending: false });
                    
                    if (!error && data) {
                        this.notes = data;
                        // Update localStorage
                        localStorage.setItem('blurting_notes', JSON.stringify(data));
                        console.log('Successfully synced with Supabase');
                    } else if (error && (error.code === 'PGRST116' || error.code === 'PGRST205')) {
                        console.log('Table blurting_notes does not exist yet. Please run the SQL setup first.');
                        this.showNotification('Database table not found. Notes will be saved locally until you set up the database.', 'info');
                    } else if (error) {
                        console.log('Supabase error:', error);
                        this.showNotification('Database connection failed. Notes will be saved locally.', 'info');
                    }
                } catch (error) {
                    console.log('Supabase sync failed, using localStorage:', error);
                    if (error.message && error.message.includes('404')) {
                        this.showNotification('Database table not found. Please run the SQL setup in Supabase.', 'info');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.notes = [];
        }
    }
    
    async saveNote(noteData) {
        try {
            let savedNote;
            
            if (this.isEditing && this.currentNote) {
                // Update existing note
                const index = this.notes.findIndex(note => note.id === this.currentNote.id);
                if (index !== -1) {
                    this.notes[index] = {
                        ...this.notes[index],
                        title: noteData.title,
                        content: noteData.content,
                        updated_at: new Date().toISOString()
                    };
                    savedNote = this.notes[index];
                }
            } else {
                // Create new note
                savedNote = {
                    id: Date.now().toString(),
                    title: noteData.title,
                    content: noteData.content,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                this.notes.unshift(savedNote);
            }
            
            // Save to localStorage
            localStorage.setItem('blurting_notes', JSON.stringify(this.notes));
            
            // Try to sync with Supabase if available
            if (typeof supabase !== 'undefined' && window.supabaseClient) {
                try {
                    if (this.isEditing && this.currentNote) {
                        // Get current user ID from Supabase auth
                        const { data: { user } } = await window.supabaseClient.auth.getUser();
                        const userId = user ? user.id : null;
                        
                        if (!userId) {
                            console.log('No authenticated user, skipping Supabase sync');
                            return savedNote;
                        }
                        
                        const { error: updateError } = await window.supabaseClient
                            .from('blurting_notes')
                            .update({
                                title: noteData.title,
                                content: noteData.content,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', this.currentNote.id)
                            .eq('user_id', userId); // Ensure user can only update their own notes
                        
                        if (!updateError) {
                            console.log('Note updated in Supabase');
                        } else {
                            throw updateError;
                        }
                    } else {
                        // Get current user ID from Supabase auth
                        const { data: { user } } = await window.supabaseClient.auth.getUser();
                        const userId = user ? user.id : null;
                        
                        if (!userId) {
                            console.log('No authenticated user, skipping Supabase sync');
                            return savedNote;
                        }
                        
                        const { error: insertError } = await window.supabaseClient
                            .from('blurting_notes')
                            .insert([{
                                title: noteData.title,
                                content: noteData.content,
                                user_id: userId
                            }]);
                        
                        if (!insertError) {
                            console.log('Note created in Supabase');
                        } else {
                            throw insertError;
                        }
                    }
                } catch (error) {
                    console.log('Supabase sync failed, note saved locally:', error);
                    if (error.message && error.message.includes('404') || (error.code && (error.code === 'PGRST116' || error.code === 'PGRST205'))) {
                        this.showNotification('Database table not found. Note saved locally.', 'info');
                    } else if (error.code === '22P02') {
                        this.showNotification('Authentication required. Note saved locally.', 'info');
                    } else if (error.message && error.message.includes('JWT')) {
                        this.showNotification('Please sign in to sync notes to the cloud.', 'info');
                    }
                }
            }
            
            return savedNote;
        } catch (error) {
            console.error('Failed to save note:', error);
            throw error;
        }
    }
    
    async deleteNote(noteId) {
        try {
            // Try to delete from Supabase first if available
            if (typeof supabase !== 'undefined' && window.supabaseClient) {
                try {
                    await window.supabaseClient
                        .from('blurting_notes')
                        .delete()
                        .eq('id', noteId);
                } catch (error) {
                    console.log('Supabase delete failed:', error);
                }
            }
            
            // Remove from local notes array
            this.notes = this.notes.filter(note => note.id !== noteId);
            
            // Update localStorage
            localStorage.setItem('blurting_notes', JSON.stringify(this.notes));
            
            return true;
        } catch (error) {
            console.error('Failed to delete note:', error);
            throw error;
        }
    }
    
    renderNotes() {
        const notesList = document.getElementById('notesList');
        if (!notesList) return;
        
        if (this.notes.length === 0) {
            notesList.innerHTML = `
                <div class="note-item" style="text-align: center; color: #666; cursor: default;">
                    <p>No notes yet. Click "New Note" to create your first note.</p>
                </div>
            `;
            return;
        }
        
        notesList.innerHTML = this.notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-title">${this.escapeHtml(note.title)}</div>
                <div class="note-date">${this.formatDate(note.created_at)}</div>
                <div class="note-actions">
                    <button class="action-btn edit" data-note-id="${note.id}">Edit</button>
                    <button class="action-btn delete" data-note-id="${note.id}">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Add click event listeners to note items
        this.notes.forEach(note => {
            const noteElement = notesList.querySelector(`[data-note-id="${note.id}"]`);
            if (noteElement) {
                noteElement.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('action-btn')) {
                        this.previewNote(note);
                    }
                });
            }
        });
    }
    
    openNote(note) {
        this.currentNote = note;
        this.isEditing = true;
        
        document.getElementById('modalTitle').textContent = 'Edit Note';
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').value = note.content;
        
        this.showModal('noteModal');
        
        // Re-render MathJax after modal is shown
        setTimeout(() => {
            if (window.MathJax) {
                window.MathJax.typeset();
            }
        }, 100);
    }
    
    previewNote(note) {
        this.currentNote = note;
        
        document.getElementById('previewTitle').textContent = note.title;
        
        // Convert the note content to HTML with LaTeX rendering
        const content = this.convertContentToHTML(note.content);
        document.getElementById('notePreviewContent').innerHTML = content;
        
        this.showModal('previewModal');
        
        // Render MathJax after modal is shown
        setTimeout(() => {
            if (window.MathJax) {
                window.MathJax.typeset();
            }
        }, 100);
    }
    
    convertContentToHTML(content) {
        if (!content) return '<p>No content</p>';
        
        // Split content into lines
        const lines = content.split('\n');
        let html = '';
        let inCodeBlock = false;
        let codeBlockContent = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Handle code blocks
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    // End code block
                    html += `<pre><code>${codeBlockContent}</code></pre>`;
                    codeBlockContent = '';
                    inCodeBlock = false;
                } else {
                    // Start code block
                    inCodeBlock = true;
                    codeBlockContent = '';
                }
                continue;
            }
            
            if (inCodeBlock) {
                codeBlockContent += line + '\n';
                continue;
            }
            
            // Handle empty lines
            if (line === '') {
                html += '<br>';
                continue;
            }
            
            // Handle headings
            if (line.startsWith('#')) {
                const level = line.match(/^#+/)[0].length;
                const text = line.replace(/^#+\s*/, '');
                html += `<h${level}>${this.escapeHtml(text)}</h${level}>`;
                continue;
            }
            
            // Handle lists
            if (line.match(/^[\-\*]\s/)) {
                const text = line.replace(/^[\-\*]\s/, '');
                html += `<li>${this.escapeHtml(text)}</li>`;
                continue;
            }
            
            if (line.match(/^\d+\.\s/)) {
                const text = line.replace(/^\d+\.\s/, '');
                html += `<li>${this.escapeHtml(text)}</li>`;
                continue;
            }
            
            // Handle blockquotes
            if (line.startsWith('>')) {
                const text = line.replace(/^>\s*/, '');
                html += `<blockquote>${this.escapeHtml(text)}</blockquote>`;
                continue;
            }
            
            // Handle inline code
            if (line.includes('`')) {
                const processedLine = line.replace(/`([^`]+)`/g, '<code>$1</code>');
                html += `<p>${this.escapeHtml(processedLine)}</p>`;
                continue;
            }
            
            // Regular paragraph
            html += `<p>${this.escapeHtml(line)}</p>`;
        }
        
        // Close any open code block
        if (inCodeBlock) {
            html += `<pre><code>${codeBlockContent}</code></pre>`;
        }
        
        return html;
    }
    
    openNewNote() {
        this.currentNote = null;
        this.isEditing = false;
        
        document.getElementById('modalTitle').textContent = 'New Note';
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        
        this.showModal('noteModal');
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    setupEventListeners() {
        // New note button
        const newNoteBtn = document.getElementById('newNoteBtn');
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', () => this.openNewNote());
        }
        
        // Modal close buttons
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideModal('noteModal'));
        }
        
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => this.hideModal('deleteModal'));
        }
        
        const closePreviewModal = document.getElementById('closePreviewModal');
        if (closePreviewModal) {
            closePreviewModal.addEventListener('click', () => this.hideModal('previewModal'));
        }
        
        // Cancel buttons
        const cancelNote = document.getElementById('cancelNote');
        if (cancelNote) {
            cancelNote.addEventListener('click', () => this.hideModal('noteModal'));
        }
        
        const cancelDelete = document.getElementById('cancelDelete');
        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => this.hideModal('deleteModal'));
        }
        
        const closePreview = document.getElementById('closePreview');
        if (closePreview) {
            closePreview.addEventListener('click', () => this.hideModal('previewModal'));
        }
        
        const editNote = document.getElementById('editNote');
        if (editNote) {
            editNote.addEventListener('click', () => {
                this.hideModal('previewModal');
                this.openNote(this.currentNote);
            });
        }
        
        // Save note button
        const saveNote = document.getElementById('saveNote');
        if (saveNote) {
            saveNote.addEventListener('click', () => this.handleSaveNote());
        }
        
        // Formula buttons
        const formulaBtns = document.querySelectorAll('.formula-btn');
        formulaBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const formula = btn.getAttribute('data-formula');
                this.insertFormula(formula);
            });
        });
        
        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal('noteModal');
                this.hideModal('deleteModal');
                this.hideModal('previewModal');
            }
        });
        
        // Handle note actions (edit/delete)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn')) {
                e.stopPropagation();
                const noteId = e.target.getAttribute('data-note-id');
                
                if (e.target.classList.contains('edit')) {
                    const note = this.notes.find(n => n.id === noteId);
                    if (note) this.openNote(note);
                } else if (e.target.classList.contains('delete')) {
                    this.confirmDeleteNote(noteId);
                }
            }
        });
        
        // Delete confirmation
        const confirmDelete = document.getElementById('confirmDelete');
        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.handleDeleteNote());
        }
    }
    
    async handleSaveNote() {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        
        if (!title) {
            alert('Please enter a title for your note.');
            return;
        }
        
        try {
            await this.saveNote({ title, content });
            this.hideModal('noteModal');
            this.renderNotes();
            
            // Show success message
            this.showNotification('Note saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save note:', error);
            this.showNotification('Failed to save note. Please try again.', 'error');
        }
    }
    
    confirmDeleteNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            document.getElementById('deleteNoteTitle').textContent = note.title;
            this.currentNote = note;
            this.showModal('deleteModal');
        }
    }
    
    async handleDeleteNote() {
        if (!this.currentNote) return;
        
        try {
            await this.deleteNote(this.currentNote.id);
            this.hideModal('deleteModal');
            this.renderNotes();
            this.currentNote = null;
            
            this.showNotification('Note deleted successfully!', 'success');
        } catch (error) {
            console.error('Failed to delete note:', error);
            this.showNotification('Failed to delete note. Please try again.', 'error');
        }
    }
    
    insertFormula(formula) {
        const textarea = document.getElementById('noteContent');
        const cursorPos = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, cursorPos);
        const textAfter = textarea.value.substring(cursorPos);
        
        // Insert formula with proper LaTeX delimiters
        let formattedFormula = formula;
        if (!formula.includes('\\')) {
            // Simple formula, wrap in inline math
            formattedFormula = `$${formula}$`;
        } else if (formula.includes('\\int') || formula.includes('\\sum') || formula.includes('\\frac')) {
            // Complex formula, wrap in display math
            formattedFormula = `$$${formula}$$`;
        } else {
            // Other LaTeX commands, wrap in inline math
            formattedFormula = `$${formula}$`;
        }
        
        textarea.value = textBefore + formattedFormula + textAfter;
        textarea.focus();
        
        // Set cursor position after the inserted formula
        const newCursorPos = cursorPos + formattedFormula.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
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
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BlurtingApp();
});
