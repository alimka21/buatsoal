import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexProps {
  children: string;
  delimiters?: { left: string; right: string; display: boolean }[];
}

const Latex: React.FC<LatexProps> = ({ children, delimiters = [
    { left: '$$', right: '$$', display: true },
    { left: '\\(', right: '\\)', display: false },
    { left: '$', right: '$', display: false },
    { left: '\\[', right: '\\]', display: true },
] }) => {
    const renderedContent = useMemo(() => {
        if (!children) return null;

        // Simple parser to split text by delimiters
        // This is a simplified version and might not handle nested delimiters correctly
        // but works for standard use cases.
        
        const regexPattern = delimiters.map(d => {
             const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             return `(${escape(d.left)}[\\s\\S]*?${escape(d.right)})`;
        }).join('|');
        
        const regex = new RegExp(regexPattern, 'g');
        const parts = children.split(regex);
        
        return parts.map((part, index) => {
            if (!part) return null;

            // Check if this part matches any delimiter
            const delimiter = delimiters.find(d => part.startsWith(d.left) && part.endsWith(d.right));

            if (delimiter) {
                const mathContent = part.slice(delimiter.left.length, -delimiter.right.length);
                try {
                    const html = katex.renderToString(mathContent, {
                        displayMode: delimiter.display,
                        throwOnError: false,
                        output: 'html', // Generate HTML output
                    });
                    return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                } catch (e) {
                    console.error("KaTeX error:", e);
                    return <span key={index} className="text-red-500">{part}</span>;
                }
            } else {
                return <span key={index}>{part}</span>;
            }
        });
    }, [children, delimiters]);

    return <>{renderedContent}</>;
};

export default Latex;
