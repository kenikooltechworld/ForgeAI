@echo off
REM ForgeAI compilation and testing script
REM This will compile the extension and help debug the tool registry issue

echo.
echo ========== ForgeAI Compilation & Debug ==========
echo.

cd /d "c:\Users\KENIKOOL TECH WORLD\Desktop\ForgeAI"

echo [1/3] Running npm run compile...
call npm run compile

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Compilation failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Compilation successful! Now run these commands in ForgeAI VS Code:
echo.
echo  - Close and reopen the ForgeAI extension
echo  - Open the ForgeAI Chat panel
echo  - Type a message to trigger the master agent
echo  - Check the "ForgeAI" output channel for debug logs:
echo     - "[ToolRegistry] Registered X tools"
echo     - "[ToolRegistry.getToolDefinitions] Returning X tools"
echo     - "[WebviewManager] Master agent tools OK" or error
echo     - "[AgentLoop.execute] Master agent starting with X tools"
echo.
echo [3/3] Reviewing logs...
echo.
echo If you see these messages:
echo  - "[AgentLoop.execute] CRITICAL: forgeai_spawnAgent NOT found in master tools!"
echo  - OR "[AgentLoop.execute] CRITICAL: Master agent has NO tools!"
echo.
echo Then the tool registry is broken. Share these logs and I'll fix it.
echo.
echo ========== Done ==========
pause
