/**
 * ContentCleaner - Extract and clean page content
 *
 * Removes noise (ads, headers, footers, navigation, sidebars, tracking)
 * while preserving documentation, code snippets, examples, and version info.
 */

export class ContentCleaner {
  /**
   * Clean HTML content by removing unwanted elements and extracting main content.
   * Returns cleaned text suitable for caching.
   */
  static cleanContent(html: string): string {
    // Remove script, style, noscript tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

    // Remove common noise elements
    text = text.replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    text = text.replace(
      /<div[^>]*class=["']?(ads?|advertisement|banner|sidebar|nav|navigation|cookie)[^"']*["']?[^>]*>[\s\S]*?<\/div>/gi,
      ' '
    );
    text = text.replace(
      /<div[^>]*id=["']?(ads?|advertisement|banner|sidebar|nav|navigation|cookie)[^"']*["']?[^>]*>[\s\S]*?<\/div>/gi,
      ' '
    );

    // Try to extract from main content areas first
    const mainMatch =
      text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      text.match(/<div[^>]*class=["']?main-content[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*class=["']?content[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*id=["']?content[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*class=["']?documentation[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*class=["']?markdown-body[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*class=["']?prose[^"']*["']?[^>]*>([\s\S]*?)<\/div>/i);

    if (mainMatch) {
      text = mainMatch[1];
    }

    // Convert common block elements to newlines
    text = text
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/section>/gi, '\n\n')
      .replace(/<\/article>/gi, '\n\n');

    // Strip all remaining tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, '...')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&copy;/g, '©')
      .replace(/&reg;/g, '®')
      .replace(/&trade;/g, '™');

    // Clean up whitespace
    text = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  }
}
