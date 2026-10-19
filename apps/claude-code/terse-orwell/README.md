# terse-orwell

Keeps Claude concise. The plugin ships the Terse Orwell output style and a set of generic behaviour rules. Hooks send the rules to every session and the style and rules to every subagent. `/terse-orwell:setup` writes your Personal layer into `~/.claude/CLAUDE.md`: name and role, languages, spelling, Git flow and package managers.

## Install

```
/plugin marketplace add unic/unic-agents-plugins
/plugin install terse-orwell@unic-agent-plugins
```

Then:

1. Run `/terse-orwell:setup` and answer its six questions. Until you do, every session starts with a warning.
2. Select the style with `/output-style` and pick `terse-orwell:Terse Orwell`. Installing the plugin does not change an `outputStyle` you already set in `~/.claude/settings.json`. If you set one, switch it yourself with `/output-style`, or set `"outputStyle": "terse-orwell:Terse Orwell"` in that file.
3. Optional: the unslop skill and the ponytail plugin. `/terse-orwell:setup` installs unslop when you say yes, and shows the commands for ponytail.

## What runs when

| Event              | What the plugin sends                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| `SessionStart`     | The generic rules, plus the unslop skill's text when it is installed          |
| `SubagentStart`    | The output style and the generic rules, because subagents never see the style |
| `UserPromptSubmit` | `Reply to the user in <chat>; artefacts stay <artefact>.` when the two differ |

Run `/terse-orwell:setup` again to change an answer. It replaces only the text between the terse-orwell markers.
