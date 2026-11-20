"""Select the Markdown extension for stock Markdown."""

import sublime
import sublime_plugin

MARKDOWN = "Packages/Markdown/Markdown.sublime-syntax"
PATTERN_MARKDOWN = "Packages/PatternLanguage/Markdown.sublime-syntax"
SETTING = "pattern_language_markdown_fences"
AUTO = "pattern_language_markdown_auto"
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
    if path == MARKDOWN and all(sublime.syntax_from_path(resource) is not None
                                for resource in (MARKDOWN, PATTERN_MARKDOWN)):
        settings.set(AUTO, True)
        view.assign_syntax(PATTERN_MARKDOWN)


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
