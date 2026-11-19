on run argv
    set recipientNumber to item 1 of argv
    set contentKind to item 2 of argv
    set contentValue to item 3 of argv
    set targetChatId to "any;-;" & recipientNumber

    tell application "Messages"
        if not (exists chat id targetChatId) then error "Recipient chat is unavailable"
        set targetChat to chat id targetChatId
        if contentKind is "file" then
            send (POSIX file contentValue) to targetChat
        else if contentKind is "text" then
            send contentValue to targetChat
        else
            error "Unsupported content kind"
        end if
    end tell
end run
