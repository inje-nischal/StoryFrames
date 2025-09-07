// Extract main article content from page
function extractArticleText() {
    let articleText = '';

    // Try multiple selectors to find article content
    const selectors = [
        'article',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        'main'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            articleText = element.innerText;
            if (articleText.length > 100) { // Only use if substantial content
                break;
            }
        }
    }

    // Fallback: collect all paragraphs
    if (!articleText || articleText.length < 100) {
        const paragraphs = Array.from(document.querySelectorAll('p'))
            .map(p => p.innerText.trim())
            .filter(text => text.length > 20) // Filter out short/empty paragraphs
            .slice(0, 10); // Limit to first 10 substantial paragraphs

        articleText = paragraphs.join('\n\n');
    }

    // Clean up the text
    articleText = articleText
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .trim();

    return articleText;
}

// Extract and save article text
try {
    const articleText = extractArticleText();
    
    // Only save if we found substantial content
    if (articleText && articleText.length > 50) {
        chrome.storage.local.set({ 
            newsText: articleText,
            pageUrl: window.location.href,
            pageTitle: document.title,
            timestamp: new Date().toISOString()
        });
        
        console.log('Nano Banana: Article extracted successfully');
    } else {
        console.log('Nano Banana: No substantial article content found');
    }
} catch (error) {
    console.error('Nano Banana: Error extracting article:', error);
}