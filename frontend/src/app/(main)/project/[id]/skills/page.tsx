"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSettingsStore, Skill } from '@/store/settingsStore';
import { FileText, Plus, Trash2, Save, FileCode2, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function SkillsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const { getProjectSettings, addSkill, updateSkill, deleteSkill } = useSettingsStore();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  
  // Editor state
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load skills
  useEffect(() => {
    const projSettings = getProjectSettings(projectId);
    setSkills(projSettings.skills || []);
  }, [projectId, getProjectSettings]);

  const selectedSkill = skills.find(s => s.id === selectedSkillId);

  const getUniqueSkillName = (baseName: string, currentId: string | null = null) => {
    let finalName = baseName.trim() || 'Unnamed Skill';
    const otherSkills = currentId ? skills.filter(s => s.id !== currentId) : skills;
    
    if (otherSkills.some(s => s.name === finalName)) {
      let counter = 1;
      let newName = `${finalName} (${counter})`;
      while (otherSkills.some(s => s.name === newName)) {
        counter++;
        newName = `${finalName} (${counter})`;
      }
      return newName;
    }
    return finalName;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target?.result as string;
      const fileName = file.name.replace(/\.md$/, '');
      
      const newId = `skill-${uuidv4().substring(0, 8)}`;
      const uniqueName = getUniqueSkillName(fileName, newId);
      
      const newSkill: Skill = {
        id: newId,
        name: uniqueName,
        content: fileContent,
      };
      
      addSkill(projectId, newSkill);
      setSkills(prev => [...prev, newSkill]);
      setSelectedSkillId(newSkill.id);
      setName(newSkill.name);
      setContent(newSkill.content);
    };
    reader.readAsText(file);
    
    // Clear the input so the same file can be uploaded again if deleted
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateSkill = () => {
    const newId = `skill-${uuidv4().substring(0, 8)}`;
    const uniqueName = getUniqueSkillName('New Skill', newId);
    const defaultTemplate = `---
name: ${uniqueName}
description: Briefly describe what this skill does and when the agent should use it.
---

# ${uniqueName}

## Overview
Provide a clear, high-level summary of this skill's purpose. What is the end goal? What specific problem does it solve for the user?

## Context Gathering
List the context the agent should gather before executing the main task.
- Check configuration files or project structure
- Identify the framework or language being used

## Execution Steps

### Step 1: [First Logical Action]
Describe the first action the agent should take. Provide specific tools to use or rules to follow.

### Step 2: [Second Logical Action]
Provide step-by-step instructions. If there are specific formats to follow, include examples:
\`\`\`bash
# Example command for the agent to run
npm run check
\`\`\`

## Quality Check
Before finishing the task, verify the following:
- [ ] Requirements are fully met
- [ ] No placeholder text remains in the final output
- [ ] Operations performed are safe and accurate`;

    const newSkill: Skill = {
      id: newId,
      name: uniqueName,
      content: defaultTemplate,
    };
    addSkill(projectId, newSkill);
    setSkills(prev => [...prev, newSkill]);
    setSelectedSkillId(newSkill.id);
    setName(newSkill.name);
    setContent(newSkill.content);
  };

  const handleSave = () => {
    if (!selectedSkillId) return;
    setIsSaving(true);
    
    const uniqueName = getUniqueSkillName(name, selectedSkillId);
    if (uniqueName !== name) {
      setName(uniqueName);
    }
    
    updateSkill(projectId, selectedSkillId, { name: uniqueName, content });
    
    // Update local state to reflect UI instantly
    setSkills(prev => prev.map(s => s.id === selectedSkillId ? { ...s, name: uniqueName, content } : s));
    
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this skill?')) {
      deleteSkill(projectId, id);
      setSkills(prev => prev.filter(s => s.id !== id));
      if (selectedSkillId === id) {
        setSelectedSkillId(null);
      }
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Left Sidebar - Skill List */}
      <div className="w-64 border-r border-border/50 bg-background/40 backdrop-blur-md flex flex-col h-full z-10">
        <div className="p-4 border-b border-border/50 flex justify-between items-center glass-panel">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-primary" />
            Project Skills
          </h2>
          <div className="flex items-center gap-1">
            <input 
              type="file" 
              accept=".md" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-primary"
              title="Import .md file"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button 
              onClick={handleCreateSkill}
              className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-primary"
              title="Create New Skill"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {skills.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground p-4">
              No skills yet. Create one to get started.
            </div>
          ) : (
            skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => {
                  setSelectedSkillId(skill.id);
                  setName(skill.name);
                  setContent(skill.content);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors ${
                  selectedSkillId === skill.id 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1 mr-2">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  {selectedSkillId === skill.id ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        const uniqueName = getUniqueSkillName(name, skill.id);
                        if (uniqueName !== name) setName(uniqueName);
                        updateSkill(projectId, skill.id, { name: uniqueName, content });
                        setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, name: uniqueName } : s));
                      }}
                      className="bg-transparent border-none outline-none w-full truncate text-sm p-0 m-0 focus:ring-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate">{skill.name}</span>
                  )}
                </div>
                <div
                  onClick={(e) => handleDelete(skill.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                  title="Delete Skill"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col h-full bg-transparent relative">
        {selectedSkillId ? (
          <>
            <div className="border-b border-border/50 p-4 flex items-center justify-between glass-panel z-10">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skill Name..."
                className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 rounded px-2 py-1 w-1/2"
              />
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saved!' : 'Save Skill'}
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full bg-muted/30 border rounded-lg p-4 font-mono text-sm resize-none outline-none focus:border-primary/50 transition-colors"
                placeholder="Write your skill instructions in Markdown format here..."
              />
              <div className="mt-2 text-xs text-muted-foreground">
                Tip: You can mention this skill in the System Prompt Editor using <code className="bg-muted px-1 rounded">@skills</code>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-muted-foreground">
            <FileCode2 className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a skill from the sidebar or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
