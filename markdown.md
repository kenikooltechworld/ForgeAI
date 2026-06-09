what is ask is research,: there is a critical bug or error, during research, the ai only search for just surface, not the actuall content, what i want is for te ai to do a comprehensive research base on what the discuss with the user, if the ai is doing research for tech stack , we should not just get the surface, he should navigate inside the official website documentations and get the content, what the ai will save is the content, not just the topic, is the content and finding of the result, i see that the ai do research 2 times, and the ai save topics too. i think there is different way of caching data, we need to fin them and fix this isues only one save cache should be use, observe the image, and the image, the topics get save and the content too, but no name. and the best practices that the ai is finding is not professional at all, why will ai be looking for best pracitces in facebook, what happen to github, stackoverflow, youtube, etc. please lets fix this research, websearch. but wait, how many research tools do we have because am seeing amny of them> pleae lets discuss how to solve this issues, give me a solution and plan.

another problem is this, after research, ai should compile everything he research about and create a markdown file for it, i think this will be better than creting all the cache data that is everywhere

can you check example from docs/research to understand

this should apply for general research ,not only for spec, research agent should be aware of how the output should be after research, you can give him template as sample/example
The user is right - the compileResearchMarkdown is currently only called in SpecOrchestrator, not in the general research flow. The ResearchAgent.runResearch() should also compile markdown for general research sessions. Let me update the ResearchAgent to call compileResearchMarkdown at the end of runResearch, and also update the prompt to enforce the template format.

Looking at the existing docs/research/ files, the format is:

Title with date
Research Date
Focus Areas
Primary Sources (list of URLs)
Executive Summary
Key Findings
Table of Contents
Detailed sections
I should:

Update ResearchAgent.runResearch to always call compileResearchMarkdown
Update the SystemPrompt with a template so the model knows the expected output format
The ResearchAgent's generateTopics prompt should also enforce this structure
The user wants:

Research output to follow a clear template/format (like the docs/research/\*.md examples)
This should apply to ALL research, not just spec generation
The AI should know what the expected output format is
So I need to:

Update the system prompt's research directive to include the OUTPUT FORMAT template
Make sure the compileResearchMarkdown is always called after research (not just in SpecOrchestrator)
The format should match the example files in docs/research/
Looking at the example format from browser-capability-2026.md:

Title: "# Research: {topic} — {year}"
Date stamp
Executive Summary with key findings
Numbered sections for each topic
Code examples, API references, tables where applicable
Sources with URLs at the bottom
I should update:

SystemPrompt.ts - add the output format template to getResearchDirective()
ResearchAgent.ts - call compileResearchMarkdown at the end of runResearch() (not just in SpecOrchestrator)
Let me update the system prompt first to include the template, then update runResearch() to always compile.

The core issue is that the model has no template for what good research output looks like. I'll fix this in two places:

SystemPrompt.ts — add the exact output template so the model produces structured research
ResearchAgent.ts — call compileResearchMarkdown at the end of runResearch() so every research session (spec or standalone) writes the compiled file
Now add the compileResearchMarkdown() call at the end of runResearch() so standalone research also writes the compiled file.

Now update runResearch() to always call compileResearchMarkdown() at the end.

Good - persistSession is at line 146 and return is at line 148. I'll insert compileResearchMarkdown(session) between them. Let me check the current state of the file first:

this should apply for general research ,not only for spec, research agent should be aware of how the output should be after research, you can give him template as sample/example

but i want the file directory to still be in the .forgeai/research, not in another separate directory, use what exisit, and please make sure no error, you can still check more files in the docs/research to understand more like vscode-api-2026, lucide-react-2026, etc to understand better, and another critical issue is that their should be a dynamic date and time in the system prompt file for ai to always know the current date and time so he can know that he is not in 2024 but in 2026 so the research will only be conducted for the current date, and the ai should be aware that his knowledge are oudated and cutoff

didnt we fix this research issues, why am still seeing the old methods, please when you update something, make sure you delete or erase the old one's, nothing has change, investigate everything about research tools and agents
