<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./icon-dark.png" />
    <img src="./icon-light.png" alt="Bookmarks" width="144" />
  </picture>
</p>

<div align="center">

# Bookmarks

</div>

A self-organizing bookmark library with HTML/browser imports, notes, inferred collections, and semantic search through Ryu Spaces.

> **The public home of `ryu-bookmarks`.** Source, builds, and releases live here —
> binaries for every platform are attached to each release.
>
> This tree is generated from the Ryu monorepo, so commits pushed here
> directly are replaced on the next sync. **Pull requests are welcome** —
> open them here and they are ported into the monorepo, then flow back out.
> Ryu as a whole: https://github.com/amajorai/ryu

## Install

**App:** [Install](ryu://apps/@ryu/bookmarks) (opens the Ryu desktop app and asks you to confirm)

**CLI:**

```bash
ryu apps add @ryu/bookmarks
```

## Source & build

This is the **source of record** for the app UI. It imports Ryu's private
`@ryu/ui` design system, so it does **not** build standalone outside the
monorepo — it **builds inside the amajorai/ryu monorepo workspace**.
The shipped bundle is the built artifact, produced by the monorepo build.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Parts

- **`ui/` — companion:** a self-contained desktop/extension library with HTML
  import, browser-bookmark import actions, manual add/edit, favorites, inferred
  collections, and semantic search.
- **Browser contribution:** the extension reads the app's `browser-page`
  context-menu contribution and registers the app-owned “Save page to
  Bookmarks” action. The app, rather than the extension shell, owns the label.

The library groups saved links into explicit browser folders, inferred topics, and an **Unsorted**
collection. Opening a collection previews its saved links and keeps the existing open, edit,
favorite, and delete actions available.

There is no dedicated backend or sidecar. Core owns the Space, embeddings,
retrieval, visibility, and tenancy boundaries.

## Permissions

- `spaces:docs` — own, update, and semantically search the app's bookmark documents.
- `storage:kv` — remember the user-owned Bookmarks Space id.
