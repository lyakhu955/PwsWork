css_content = """
/* ==================== ATTACHMENTS ==================== */
.btn-attachments { display: flex; align-items: center; gap: 8px; justify-content: center; width: 100%; margin-top: 10px; transition: all 0.2s; }
.btn-attachments.empty-attachments { opacity: 0.6; filter: grayscale(100%); }
.btn-attachments.has-attachments { background-color: var(--accent-primary-light); color: var(--accent-primary); border-color: var(--accent-primary); opacity: 1; filter: none; }
.attachments-count { background: var(--bg-card); border-radius: 12px; padding: 2px 6px; font-size: 0.8rem; font-weight: bold; }
.has-attachments .attachments-count { background: var(--accent-primary); color: white; }
.attachments-upload-area { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; border: 2px dashed var(--border-color-strong); border-radius: 12px; margin-bottom: 20px; text-align: center; }
.attachments-upload-hint { font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px; }
.attachments-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
.attachment-item { display: flex; align-items: center; gap: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color-strong); }
.attachment-thumbnail { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color-strong); }
.attachment-file-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); border-radius: 6px; color: var(--accent-primary); cursor: pointer; }
.attachment-details { flex: 1; min-width: 0; }
.attachment-name { font-weight: 600; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.attachment-size { font-size: 0.8rem; color: var(--text-secondary); }
.attachment-actions { display: flex; align-items: center; gap: 8px; }
"""

with open('css/style.css', 'a', encoding='utf-8') as f:
    f.write(css_content)
