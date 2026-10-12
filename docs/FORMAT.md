# Luno Studio 1.0 project format

A new schema and container, deliberately not a backward reader for Luno Animate.

`.lam` header: 52 bytes. Bytes 0–7 ASCII `LUNO1LAM`; little-endian uint16 container version 1 at offset 8; uint16 compression flags 1 at 10; uint32 uncompressed size at 12; uint32 compressed size at 16; SHA-256 of compressed payload at 20–51. Payload is raw DEFLATE containing UTF-8 JSON. Uncompressed data is bounded to 64,000,000 bytes; streaming inflation cannot exceed the declared size. Checksums detect corruption, not authorship or malicious intent.

Document: `format: luno-studio`, `schema: 1`, canvas/FPS, ordered scenes, shared embedded assets, reference notes. Scenes own layer hierarchies, transform keys, sound clips, work area and keyed camera. Painting layers own explicit cels; each ordered brush/eraser/fill mark captures its settings, pressure, geometry, seed or bounded fill bitmap. No runtime file path is trusted from the document.

Validation bounds dimensions, finite transforms, pressure, strokes, source types, asset references, clip ranges, frame keys, identity collisions, hierarchy cycles, decoded raster dimensions and procedural render work. Unknown legacy signatures are rejected before replacing active work. A future incompatible format must change the schema/container; it must not silently strip unsupported fields.
