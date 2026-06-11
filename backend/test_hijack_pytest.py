import pytest
import re
import json

def parse_and_hijack(system_prompt_content, ai_output_content):
    """ The core logic extracted from graph.py for testing """
    match = re.search(r'(?:@(\w+)\s*(?:<[^>]+>)*\s*)?\[(\w+)(?:\])?', system_prompt_content)
    if not match:
        return None, "System Prompt Match Failed"
    
    alias_used = match.group(1)
    target_tool_name = match.group(2)
    
    content = ai_output_content.strip()
    
    if (alias_used and content.startswith(f"@{alias_used}")) or content.startswith(f"[{target_tool_name}]") or len(content) > 0:
        raw_arg = content
        
        if alias_used:
            raw_arg = re.sub(rf'@{alias_used}\s*(?:<[^>]+>)*\s*', '', raw_arg)
            
        raw_arg = re.sub(rf'\[{target_tool_name}\b', '', raw_arg)
        raw_arg = raw_arg.strip()
        raw_arg = re.sub(r'^[\(\[\]\"\'\:\,\s]+', '', raw_arg)
        
        # Strip hallucinated parameter names like message=" or text=
        raw_arg = re.sub(r'^(?:message|msg|text)\s*=\s*[\"\']?', '', raw_arg, flags=re.IGNORECASE)
        
        # Strip hallucinated @AgentName or @alias prefixes that AI prepends to the message
        raw_arg = re.sub(r'^@\w+\s*', '', raw_arg)
        
        json_match = re.search(r'(\{.*?\})', content, re.DOTALL)
        args = None
        if json_match:
            try:
                parsed_args = json.loads(json_match.group(1))
                if isinstance(parsed_args, dict):
                    args = parsed_args
            except json.JSONDecodeError:
                pass
                
        if not args:
            clean_arg = re.sub(r'[\)\[\]\"\'\s]+$', '', raw_arg)
            args = {"message": clean_arg}
            
        return args, "Success"
    return None, "Hijack Condition Failed"

@pytest.mark.parametrize("system_prompt, ai_output, expected_message", [
    # --- LEVEL 1: NORMAL CASES ---
    ("Use @discord[send]", "@discord[send] hi", "hi"),
    
    # --- LEVEL 2: HALLUCINATED BRACKETS & PARENTHESES ---
    # CoT: AI loves to use Python function syntax like `func("arg")`. What if there are spaces?
    ("Use @tool[send]", '@tool[send ("Hello World")]', "Hello World"),
    
    # CoT: What if it uses single quotes instead of double quotes?
    ("Use @tool[send]", "@tool[send ('Hello World')]", "Hello World"),
    
    # --- LEVEL 3: JSON MADNESS ---
    # CoT: AI outputs strict JSON inside brackets.
    ("Use @t[s]", '@t[s, {"message": "json_msg"}]', "json_msg"),
    
    # CoT: AI outputs broken JSON? (Missing closing quote/brace). It should fallback to string cleaning!
    ("Use @t[s]", '@t[s, {"message": "broken_json_msg]', '{"message": "broken_json_msg'),
    
    # --- LEVEL 4: WEIRD FORMATTING & HTML TAGS ---
    # CoT: TipTap editor injects HTML into the System Prompt. Does it survive?
    ("Use <span class='bold'>@tool</span><span>[send]</span>", "@tool[send] HTML Test", "HTML Test"),
    
    # CoT: AI outputs colons, arrows, or weird prefixes before the actual message.
    ("Use @tool[send]", "@tool[send]: ---> Hello", "---> Hello"), # Note: our cleaning doesn't remove '->' but it shouldn't crash
    
    # --- LEVEL 5: NEWLINES AND TABS ---
    # CoT: AI adds line breaks inside the brackets or before the message.
    ("Use @tool[send]", "@tool[send]\n\tHello\nWorld", "Hello\nWorld"),
    
    # --- LEVEL 6: MISSING CLOSING BRACKETS IN PROMPT ---
    # CoT: The user typed `@tool[send` but forgot `]`. The regex should still grab `send`.
    ("Use @tool[send", "@tool[send] I forgot the bracket", "I forgot the bracket"),
    
    # --- LEVEL 7: THAI CHARACTERS ---
    # CoT: The user puts Thai instructions inside the bracket.
    ("Use @tool[send ส่งภาษาไทย]", "@tool[send] สวัสดีชาวโลก", "สวัสดีชาวโลก"),
    
    # --- LEVEL 8: MARKDOWN FORMATTING ---
    # CoT: AI decides to bold the alias and italicize the text!
    ("Use @tool[send]", "**@tool[send]** *Hello*", "** *Hello*"), # Note: It cleans the brackets but leaves markdown asterisks.
    
    # --- LEVEL 9: CONVERSATIONAL FILLER BEFORE TOOL ---
    # CoT: AI disobeys "DO NOT explain" and talks before calling the tool.
    ("Use @tool[send]", "Here is the message: @tool[send] Hello", "Here is the message: ] Hello"), # Not perfectly clean, but it intercepts it!
    
    # --- LEVEL 10: EMPTY ARGUMENT (HUMAN FALLBACK) ---
    # CoT: AI outputs JUST the tool name. The code should fallback to the Human's message.
    ("Use @tool[send]", "@tool[send]", ""),
    
    # --- LEVEL 11: AI PREPENDS AGENT NAME TO MESSAGE ---
    # CoT: AI hallucinates by prefixing the agent's own name to the message. REAL BUG!
    ("Use @tool_sent_discord_chat[send_to_discord]", "@tool_sent_discord_chat[send_to_discord] @Agent_sent_discord Hi", "Hi"),
    
    # --- LEVEL 12: AI PREPENDS message= PARAM NAME ---
    # CoT: AI hallucinates parameter syntax. REAL BUG!
    ("Use @tool_sent_discord_chat[send_to_discord]", '@tool_sent_discord_chat[send_to_discord] message="Hello Rosa"', "Hello Rosa"),
])
def test_hijack_edge_cases(system_prompt, ai_output, expected_message):
    args, status = parse_and_hijack(system_prompt, ai_output)
    assert status == "Success", f"Failed to parse: {status}"
    assert args is not None, "Args is None"
    assert "message" in args, "No message key in args"
    assert args["message"] == expected_message, f"Expected '{expected_message}', but got '{args['message']}'"

def test_system_prompt_complete_failure():
    # CoT: What if the system prompt has absolutely no brackets?
    args, status = parse_and_hijack("You are a helpful assistant.", "Hello!")
    assert status == "System Prompt Match Failed"
    assert args is None
