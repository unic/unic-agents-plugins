> **Unverified input, superseded by [#403](https://github.com/unic/unic-agents-plugins/issues/403).**
> This is a Perplexity answer, kept as the starting point of the 2026-08-24 grilling that decided this
> repository's Figma conventions. **Do not read it as guidance.** Two of its load-bearing claims failed
> verification against Figma's own documentation during that grilling:
>
> - Its rule that **Yes/No values become boolean toggles** cites `help.figma.com/hc/en-us/articles/360055471353`,
>   which returns **404**. Figma's live pages say something narrower: booleans control layer visibility,
>   and the remedy Figma names for permutation growth is _nesting instances_, not booleans.
> - Its rule to **name properties after the axis** (`State`, `Size`, `Type`, `Layout`) is **absent from
>   both Figma pages it cites for it**. It is blog-sourced only.
>
> Its one claim that did verify is worth keeping: _"use individual properties to control specific,
> named differences, rather than one property to control multiple changes"_
> ([Figma help](https://help.figma.com/hc/en-us/articles/39636737843735-Components-collection-Variants-and-component-set-fundamentals)).
> That rule is what condemned `card-profile-main.variant` for fusing two kinds of change.
>
> Eleven of its fifteen sources are blogs, a Reddit thread or content farms. The four that hold are
> cited directly in [#403](https://github.com/unic/unic-agents-plugins/issues/403)'s resolution comment,
> which is the decision of record and supersedes every recommendation below.

# In Figma, designers may define as variants of a component different things, both for appearance as well as for component arrangement. However this makes it hard for agents to learn an axis kind if everything is a variant. Are there good or best practices for that?

Yes—there are some pretty clear patterns for “what should be a variant axis vs. something else,” and following them makes the axis type much easier for agents (and devs) to learn. In short: keep variants for stable, structural/visual states of one component, and move optional or content-related differences into other property types or separate components.

## Core idea: one axis = one concept

Figma’s own guidance is that variant properties should represent the variable aspects of _one_ component—e.g. `State`, `Size`, `Type`—and that each property should control a single kind of difference rather than multiple changes at once.[^1][^2]

For agents, this matters a lot:

- Define properties as _semantic axes_: `state`, `size`, `layout`, `tone`, `platform`, etc., not generic “Variant 1, Variant 2”.[^2][^3]
- Make values atomic: instead of `Primary Large Disabled` as one value, use `Type=Primary`, `Size=Large`, `State=Disabled` as three axes.[^3][^2]
- Keep the same axes across component families (buttons, inputs, chips) so an agent can generalize what `state` or `size` means across the library.[^4][^3]

## When to use variants vs other properties

A common source of “everything is a variant” is using variants for things that are better modeled as component properties. Best practice is roughly:[^5][^6][^7][^3]

- **Variant property**
  - Use for visibly distinct designs or layouts of _the same component_: sizes, interaction states, types, layout modes (e.g. horizontal vs vertical card), etc.[^7][^4][^2]
  - Rule of thumb: if the change affects structure or appearance in a way you’d probably map to a different React prop value, it’s a variant axis.
- **Boolean property**
  - Use for simple on/off options: leading icon present, divider shown, “has badge,” “is full-width.”[^6][^8][^5]
  - Figma itself suggests turning `Yes/No` and `True/False` values into toggles, not separate variants.[^9][^6]
  - This dramatically reduces variant permutations and makes axis meaning clearer (“icon” is now a boolean, not an extra dimension in a variant matrix).[^6]
- **Instance swap property**
  - Use when the shape stays the same but a nested element changes: swapping one icon for another, choosing an avatar style, etc.[^5][^7][^6]
  - Agents can then learn “this axis controls nested instance choice,” instead of conflating it with layout/appearance.
- **Text property**
  - Use for labels and headings that should be editable but don’t fundamentally change the component type.[^3][^6]
- **Slot property**
  - Use for open-ended content areas—card body, modal content, complex footer—rather than exploding into dozens of “content variants.”[^5][^6]
  - Current guidance is that open-ended areas are no longer best modeled as variants; use slots instead.[^6]

By moving “with/without” axes to booleans and “which icon/content” axes to instance swap/slots, the remaining variant axes are much more obviously “state,” “size,” or “layout,” which is exactly what you want agents to detect.[^7][^6]

## Handling arrangement / layout

You specifically mentioned arrangement being modeled as variants. The nuance:

- If two layouts are _the same semantic component_ (e.g. “Card with media on top” vs “Card with media on left”), a `Layout` or `Orientation` variant axis is fine.[^7][^5]
- If two things could never reasonably be swapped into the same spot on screen (e.g. a “card” vs a “list item”, or “button” vs “dropdown”), they should be separate components, not variants of one.[^5]
- Use auto layout and slots to handle most reflow behavior (e.g. header/body/footer stacks, grid vs list) rather than pre-building a variant for every arrangement you might need.[^6][^5]

A helpful heuristic from design-system practice is: _“Could these two versions ever be swapped in place?”_ If no, split into different components; if yes, keep as variants under an axis like `Layout`.[^5]

## Naming axes for machine readability

If the goal is to make axis types learnable by agents, naming is almost as important as structure:

- **Name properties after the axis**: `State`, `Size`, `Type`, `Layout`, `Platform`, `Tone`, etc., not `Property 1`, `Style`, `Misc`.[^2][^3][^6]
- **Keep values consistent**: e.g. `Default / Hover / Pressed / Disabled` for `State`, `Small / Medium / Large` for `Size`; avoid mixing capitalization or synonyms (`sm`, `Small`, `compact`) within the same axis.[^3][^6]
- **Use intent-based names for hierarchy/theme**: `Primary / Secondary / Tertiary` instead of literal `Blue / Gray / Red`, which better communicates meaning to both humans and agents.[^3]
- **Avoid user context terms as values**: a Figma community guide explicitly advises not using user contexts (like specific page names or flows) in variant names; keep values about structure/state, not arbitrary contexts.[^10]

This gives agents a stable vocabulary: wherever they see `State`, they know it’s interaction; wherever they see `Size`, they know it’s spatial; `Layout` implies arrangement; `Type` implies semantic role, etc.[^4][^2][^3]

## Avoiding combinatorial explosion

If “everything is a variant” today, you probably have too many axes jammed into variants. Common mitigation patterns:[^9][^4][^7][^6]

- Move on/off differences to booleans (`hasIcon`, `hasDivider`).[^8][^6]
- Move open-ended content to slots instead of “card-with-cta,” “card-with-long-copy,” etc.[^6][^5]
- Use variables for theme (light/dark, brand palettes) instead of separate color variants in every component.[^7]
- Split genuinely different components rather than keeping them all in one “super mega variant set.”[^7][^5]

Each of these reduces the total variant count and makes the remaining axes much more legible—ideal for automated design-to-code tools or MCP agents that need to infer axis semantics.

## Concrete example pattern

For something like a button, a scalable, agent-friendly setup might look like:[^1][^5][^6][^7]

- Variant properties
  - `Type`: `Primary | Secondary | Text`
  - `Size`: `Small | Medium | Large`
  - `State`: `Default | Hover | Pressed | Disabled`
- Component properties
  - Boolean: `hasLeadingIcon`, `isFullWidth`
  - Instance swap: `icon` (from your icon set)
  - Text: `label`

This keeps three clear variant axes that encode real component props, and everything else is either a boolean or an instance slot. Agents see a clean matrix rather than a single “Variant” dimension that mixes state, size, icon presence, and layout all together.[^2][^3][^6]

If you describe your current variant sets (e.g. a screenshot or property list for one of your more complex components), I can help you refactor axes into a scheme that is both Figma-idiomatic and agent-friendly.
<span style="display:none">[^11][^12][^13][^14][^15]</span>

[^1]: https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants

[^2]: https://help.figma.com/hc/en-us/articles/39636737843735-Components-collection-Variants-and-component-set-fundamentals

[^3]: https://www.graduateschool.edu/learn/figma/figma-component-properties

[^4]: https://www.figma.com/best-practices/creating-and-organizing-variants/

[^5]: https://artofstyleframe.com/blog/figma-components-variants-auto-layout/

[^6]: https://pixelfineconverter.com/blog/figma-variants/

[^7]: https://justfigma.com/figma-components-and-variants-practical-guide/

[^8]: https://www.reddit.com/r/FigmaDesign/comments/1bilwcz/components_properties_variants_best_practices/

[^9]: https://help.figma.com/hc/en-us/articles/360055471353-Prepare-for-variants

[^10]: https://www.figma.com/community/file/1025879564243261729/dynamic-components-variants-in-design-systems

[^11]: https://www.figma.com/community/file/1067171178880468621/when-you-should-use-variants-vs-creating-separate-components

[^12]: https://forum.figma.com/ask-the-community-7/using-variants-for-the-foundations-for-desktop-mobile-or-creating-2-separate-libraries-23944

[^13]: https://uxdesign.cc/one-variant-to-rule-them-all-92e685bae918

[^14]: https://story.to.design/docs/axis

[^15]: https://medium.com/timeless/a-better-way-to-combine-your-variants-in-the-design-system-2615eff1d158
