import re
import json

def test_hijack_parsing(system_prompt_content, ai_output_content):
    print(f"\n--- Testing AI Output: {ai_output_content} ---")
    
    # 1. Parse System Prompt
    match = re.search(r'(?:@(\w+)\s*(?:<[^>]+>)*\s*)?\[(\w+)(?:\])?', system_prompt_content)
    if not match:
        print("FAILED: Regex did not match system prompt.")
        return
    
    alias_used = match.group(1)
    target_tool_name = match.group(2)
    print(f"System Prompt Parsed -> Alias: {alias_used}, Tool: {target_tool_name}")
    
    content = ai_output_content.strip()
    
    # 2. Hijack condition
    if (alias_used and content.startswith(f"@{alias_used}")) or content.startswith(f"[{target_tool_name}]") or len(content) > 0:
        raw_arg = content
        
        # Strip alias and tool name
        if alias_used:
            raw_arg = re.sub(rf'@{alias_used}\s*(?:<[^>]+>)*\s*', '', raw_arg)
        # Remove [tool_name
        raw_arg = re.sub(rf'\[{target_tool_name}\b', '', raw_arg)
        
        raw_arg = raw_arg.strip()
        raw_arg = re.sub(r'^[:\s]+', '', raw_arg)
        
        # Try JSON extraction
        json_match = re.search(r'(\{.*?\})', content, re.DOTALL)
        args = None
        if json_match:
            try:
                parsed_args = json.loads(json_match.group(1))
                if isinstance(parsed_args, dict):
                    args = parsed_args
                    print("OK JSON Extraction Success!")
            except json.JSONDecodeError:
                pass
                
        if not args:
            clean_arg = re.sub(r'^[\(\[\]\"\'\s]+|[\)\[\]\"\'\s]+$', '', raw_arg)
            args = {"message": clean_arg}
            print("OK String Cleaning Success!")
            
        print(f"Final Extracted Args: {args}")
        return args

if __name__ == '__main__':
    # Test Case 1: Standard usage (Alias + brackets)
    test_hijack_parsing(
        system_prompt_content="Your ONLY job is to use @tool_sent_discord_chat[send_to_discord]",
        ai_output_content="@tool_sent_discord_chat[send_to_discord] Hello World"
    )

    # Test Case 2: User forgets closing bracket in prompt
    test_hijack_parsing(
        system_prompt_content="Your ONLY job is to use @tool_sent_discord_chat[send_to_discord",
        ai_output_content="@tool_sent_discord_chat[send_to_discord] Hello World"
    )

    # Test Case 3: AI hallucinates Python function format
    test_hijack_parsing(
        system_prompt_content="Your ONLY job is to use @tool_sent_discord_chat[send_to_discord]",
        ai_output_content='@tool_sent_discord_chat[send_to_discord ("Rosa in Discord")]'
    )

    # Test Case 4: AI hallucinates JSON format inside brackets
    test_hijack_parsing(
        system_prompt_content="Your ONLY job is to use @tool_sent_discord_chat[send_to_discord]",
        ai_output_content='@tool_sent_discord_chat[send_to_discord, {"message": "hello world in ros"}]'
    )
    
    # Test Case 5: AI hallucinates colon prefix
    test_hijack_parsing(
        system_prompt_content="Your ONLY job is to use @tool_sent_discord_chat[send_to_discord]",
        ai_output_content='@tool_sent_discord_chat[send_to_discord]: "Hello this is a test"'
    )
    
    # Test Case 6: User puts text inside bracket
    test_hijack_parsing(
        system_prompt_content="Your ONLY job is to use @tool_sent_discord_chat[send_to_discord hello]",
        ai_output_content='@tool_sent_discord_chat[send_to_discord] Hello'
    )
