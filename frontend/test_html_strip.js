const assert = require('assert');

function stripHtmlLikeFrontend(htmlString) {
    if (!htmlString) return '';
    return htmlString
        .replace(/<\/(p|div|h[1-6])>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>?/gm, '')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

const testCases = [
    // --- LEVEL 1: Normal TipTap Mention ---
    {
        name: "Basic Mention",
        input: `<p>Your job is to use <span class="mention" data-id="tool_sent_discord_chat">@tool_sent_discord_chat</span> [send_to_discord] now.</p>`,
        expected: "Your job is to use @tool_sent_discord_chat [send_to_discord] now."
    },
    
    // --- LEVEL 2: Multiple Mentions & Formatting ---
    {
        name: "Bold and Mentions",
        input: `<p><strong>Important:</strong> Call <span data-id="tool">@tool</span>[send] and <span data-id="agent">#agent</span>.</p>`,
        expected: "Important: Call @tool[send] and #agent."
    },
    
    // --- LEVEL 3: Deeply Nested HTML ---
    {
        name: "Nested Tags",
        input: `<div><p><span>Hello</span> <br> <span style="color:red;">@tool[send]</span></p></div>`,
        expected: "Hello \n @tool[send]"
    },
    
    // --- LEVEL 4: Malformed HTML (Unclosed tags) ---
    {
        name: "Unclosed Tag",
        input: `<p>Use <span class="broken">@tool[send]`, // Missing closing span and p
        expected: "Use @tool[send]"
    },
    
    // --- LEVEL 5: Line Breaks and Paragraphs ---
    {
        name: "Paragraph Spacing",
        input: `<p>Line 1</p><p>Line 2</p><div>Line 3</div>`,
        expected: "Line 1\nLine 2\nLine 3"
    },
    
    // --- LEVEL 6: Thai Characters with HTML ---
    {
        name: "Thai with HTML",
        input: `<p>ช่วยส่งข้อความด้วย <span data-id="tool">@tool</span>[send] หน่อยครับ</p>`,
        expected: "ช่วยส่งข้อความด้วย @tool[send] หน่อยครับ"
    }
];

let passed = 0;
let failed = 0;

console.log("=========================================");
console.log("   FRONTEND HTML STRIPPER TEST SUITE");
console.log("=========================================\n");

testCases.forEach((tc, index) => {
    const result = stripHtmlLikeFrontend(tc.input);
    try {
        // We use loose equality for spaces because trimming might vary slightly, 
        // but for strict testing we check exactly.
        // Normalize whitespace for easier comparison of line breaks
        const normResult = result.replace(/ +/g, ' ').replace(/\n /g, '\n').trim();
        const normExpected = tc.expected.replace(/ +/g, ' ').replace(/\n /g, '\n').trim();
        
        assert.strictEqual(normResult, normExpected);
        console.log(`[PASS] Test ${index + 1}: ${tc.name}`);
        passed++;
    } catch (e) {
        console.log(`[FAIL] Test ${index + 1}: ${tc.name}`);
        console.log(`   Input:    ${tc.input}`);
        console.log(`   Expected: '${tc.expected}'`);
        console.log(`   Got:      '${result}'`);
        failed++;
    }
});

console.log("\n=========================================");
console.log(`Result: ${passed} PASSED, ${failed} FAILED`);
console.log("=========================================");

if (failed > 0) process.exit(1);
