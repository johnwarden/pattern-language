"""Select the Markdown extension only for stock Markdown with Pattern fences."""

import sublime
import sublime_plugin

MARKDOWN = "Packages/Markdown/Markdown.sublime-syntax"
PATTERN_MARKDOWN = "Packages/PatternLanguage/Markdown.sublime-syntax"
SETTING = "pattern_language_markdown_fences"
AUTO = "pattern_language_markdown_auto"
# CommonMark: at most 3 spaces before a fence (stock Sublime uses ^[ \t]*).
FENCE = r"(?im)^[ ]{0,3}(?:`{3,}|~{3,})[ \t]*pattern(?:-language)?(?=[ \t\r\n]|$)"
_active = True


def _syntax_path(view):
    syntax = view.syntax()
    return syntax.path if syntax else None


def _restore(view):
    if view.settings().get(AUTO) and _syntax_path(view) == PATTERN_MARKDOWN:
        if sublime.syntax_from_path(MARKDOWN) is None:
            return
        view.assign_syntax(MARKDOWN)
    view.settings().erase(AUTO)


def _refresh(view):
    if not _active or not view.is_valid():
        return
    path = _syntax_path(view)
    settings = view.settings()
    if path not in (MARKDOWN, PATTERN_MARKDOWN):
        settings.erase(AUTO)
        return
    enabled = settings.get(
        SETTING, sublime.load_settings("Preferences.sublime-settings").get(SETTING, True)
    )
    if not enabled:
        _restore(view)
        return
    # Keep an explicitly selected extension even before the first fence is typed.
    if path == PATTERN_MARKDOWN and not settings.get(AUTO):
        return
    if view.find(FENCE, 0):
        if path == MARKDOWN:
            # MarkdownEditing can disable the stock package. Never assign an
            # unavailable syntax or an extension whose parent cannot load.
            if any(sublime.syntax_from_path(path) is None
                   for path in (MARKDOWN, PATTERN_MARKDOWN)):
                return
            settings.set(AUTO, True)
            view.assign_syntax(PATTERN_MARKDOWN)
    else:
        _restore(view)


def plugin_loaded():
    global _active
    _active = True
    for window in sublime.windows():
        for view in window.views():
            _refresh(view)


def plugin_unloaded():
    global _active
    _active = False
    for window in sublime.windows():
        for view in window.views():
            _restore(view)


class PatternLanguageMarkdownListener(sublime_plugin.EventListener):
    def on_load(self, view):
        _refresh(view)

    def on_activated(self, view):
        _refresh(view)

    def on_post_save(self, view):
        _refresh(view)

    def on_modified(self, view):
        if _syntax_path(view) not in (MARKDOWN, PATTERN_MARKDOWN):
            return
        change = view.change_count()
        sublime.set_timeout(
            lambda: _refresh(view)
            if view.is_valid() and view.change_count() == change
            else None,
            250,
        )
