/**
 * DocumentationViewer - Interactive Documentation Browser
 *
 * Displays project documentation from /docs folder with:
 * - Sidebar navigation
 * - Markdown rendering
 * - Search functionality
 * - Responsive design
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Book, Search, FileText, Code, Settings, HelpCircle, Wrench, GitBranch, Users, AlertCircle } from 'lucide-react';

// Documentation structure mapping
const DOCS_STRUCTURE = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Book className="w-4 h-4" />,
    docs: [
      { id: 'README', file: 'README.md', title: 'Overview' },
      { id: 'INSTALLATION', file: 'INSTALLATION.md', title: 'Installation' },
      { id: 'USER_GUIDE', file: 'USER_GUIDE.md', title: 'User Guide' }
    ]
  },
  {
    id: 'algorithms',
    title: 'Algorithms & Methods',
    icon: <Code className="w-4 h-4" />,
    docs: [
      { id: 'ALGORITHMS', file: 'ALGORITHMS.md', title: 'FBA Algorithms' },
      { id: 'REFERENCE_MODELS', file: 'REFERENCE_MODELS.md', title: 'Reference Models' }
    ]
  },
  {
    id: 'development',
    title: 'Development',
    icon: <Wrench className="w-4 h-4" />,
    docs: [
      { id: 'DEVELOPER_GUIDE', file: 'DEVELOPER_GUIDE.md', title: 'Developer Guide' },
      { id: 'ARCHITECTURE', file: 'ARCHITECTURE.md', title: 'Architecture' },
      { id: 'API', file: 'API.md', title: 'API Reference' },
      { id: 'CONTRIBUTING', file: 'CONTRIBUTING.md', title: 'Contributing' }
    ]
  },
  {
    id: 'operations',
    title: 'Operations',
    icon: <Settings className="w-4 h-4" />,
    docs: [
      { id: 'DEPLOYMENT', file: 'DEPLOYMENT.md', title: 'Deployment' },
      { id: 'TROUBLESHOOTING', file: 'TROUBLESHOOTING.md', title: 'Troubleshooting' }
    ]
  },
  {
    id: 'project',
    title: 'Project Info',
    icon: <GitBranch className="w-4 h-4" />,
    docs: [
      { id: 'CHANGELOG', file: 'CHANGELOG.md', title: 'Changelog' }
    ]
  }
];

// Simple markdown to HTML converter (basic implementation)
const markdownToHtml = (markdown) => {
  if (!markdown) return '';

  let html = markdown;

  // Code blocks (fenced with ```)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded p-4 overflow-x-auto my-4"><code class="text-sm font-mono">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-sm font-mono text-[var(--primary)]">$1</code>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-[var(--text-primary)] mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-[var(--text-primary)] mt-8 mb-4 pb-2 border-b border-[var(--border-color)]">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-[var(--text-primary)] mb-6">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="font-bold italic">$1</strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[var(--primary)] hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Lists
  html = html.replace(/^\* (.+)$/gim, '<li class="ml-6 list-disc text-[var(--text-primary)] my-1">$1</li>');
  html = html.replace(/^- (.+)$/gim, '<li class="ml-6 list-disc text-[var(--text-primary)] my-1">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-6 list-decimal text-[var(--text-primary)] my-1">$1</li>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gim, '<blockquote class="border-l-4 border-[var(--primary)] pl-4 py-2 my-4 bg-[var(--bg-primary)] text-[var(--text-secondary)] italic">$1</blockquote>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="text-[var(--text-primary)] leading-relaxed my-3">');

  // Wrap in paragraph
  html = '<p class="text-[var(--text-primary)] leading-relaxed my-3">' + html + '</p>';

  return html;
};

export default function DocumentationViewer() {
  const [selectedDoc, setSelectedDoc] = useState('README');
  const [docContent, setDocContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(['getting-started']);

  // Load documentation content
  useEffect(() => {
    const loadDoc = async () => {
      setLoading(true);
      setError(null);

      try {
        // Find the doc file
        let docFile = null;
        for (const section of DOCS_STRUCTURE) {
          const doc = section.docs.find(d => d.id === selectedDoc);
          if (doc) {
            docFile = doc.file;
            break;
          }
        }

        if (!docFile) {
          throw new Error('Documentation file not found');
        }

        // Fetch the markdown file
        const response = await fetch(`/docs/${docFile}`);
        if (!response.ok) {
          throw new Error(`Failed to load documentation: ${response.statusText}`);
        }

        const content = await response.text();
        setDocContent(content);
      } catch (err) {
        console.error('Error loading documentation:', err);
        setError(err.message);
        setDocContent('# Documentation Not Available\n\nThe requested documentation could not be loaded. Please check the file exists in the `/docs` folder.');
      } finally {
        setLoading(false);
      }
    };

    loadDoc();
  }, [selectedDoc]);

  // Filter docs based on search
  const filteredStructure = useMemo(() => {
    if (!searchQuery) return DOCS_STRUCTURE;

    const query = searchQuery.toLowerCase();
    return DOCS_STRUCTURE.map(section => ({
      ...section,
      docs: section.docs.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.id.toLowerCase().includes(query)
      )
    })).filter(section => section.docs.length > 0);
  }, [searchQuery]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Sidebar */}
      <aside className="w-72 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-y-auto">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">Documentation</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
            />
          </div>
        </div>

        <nav className="p-2">
          {filteredStructure.map(section => (
            <div key={section.id} className="mb-2">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] rounded transition-colors"
              >
                <span className="flex items-center gap-2">
                  {section.icon}
                  {section.title}
                </span>
                <span className="text-xs">{expandedSections.includes(section.id) ? '▼' : '▶'}</span>
              </button>

              {expandedSections.includes(section.id) && (
                <div className="ml-2 mt-1 space-y-1">
                  {section.docs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2 ${
                        selectedDoc === doc.id
                          ? 'bg-[var(--primary)] text-white font-medium'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      {doc.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-[var(--text-secondary)]">Loading documentation...</div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-[var(--danger-bg)] border border-[var(--danger)] rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--danger-text)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[var(--danger-text)]">Error Loading Documentation</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <article
              className="prose prose-sm max-w-none documentation-content"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(docContent) }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
