/**
 * Logical model for the obesity system map.
 *
 * Shapes mirror `src/data/obesity_system_data.json`: node ids are numeric,
 * connection ids are strings ("C001"), and every field is always present.
 */

/** Direction of effect a connection carries. */
export type Influence = 'positive' | 'negative';

/** Numeric encoding of `Influence`: +1 for positive, -1 for negative. */
export type Sign = 1 | -1;

/** A variable in the system map, positioned in the SVG coordinate space. */
export interface Node {
  id: number;
  label: string;
  /** Cluster used to lay out and colour the node on the map. */
  mapCluster: string;
  /** Canonical variable name in the Foresight obesity atlas. */
  atlasVariable: string;
  /** Cluster the variable belongs to in the atlas taxonomy. */
  atlasCluster: string;
  definition: string;
  x: number;
  y: number;
}

/** A directed causal link between two nodes. */
export interface Connection {
  id: string;
  sourceId: number;
  targetId: number;
  influence: Influence;
  sign: Sign;
}

/**
 * The three tools. Explore is home base and the default: read-only looking
 * around. Trace and Profile change what a click does, which is why the active
 * mode is indicated loudly rather than subtly.
 */
export type MapMode = 'explore' | 'trace' | 'profile' | 'intervention';

/**
 * Which way a trace walks the arrows.
 *
 * `downstream` follows them outward from a cause to what it affects;
 * `upstream` follows them backward from an outcome to what feeds into it;
 * `loops` asks whether the arrows come back round to where they started.
 *
 * `loops` is not a direction in the same sense — it is answered from the
 * precomputed loop set rather than by walking — so the functions in `lib/trace`
 * must never be called with it. `lib/loops` covers it instead.
 */
export type TraceDirection = 'downstream' | 'upstream' | 'loops';

/** What the map currently has selected. The two kinds are mutually exclusive. */
export type Selection =
  | { kind: 'node'; nodeId: number }
  | { kind: 'edge'; connectionId: string };

/* ------------------------------------------------------------------ geometry */

/** What a given <path> in the edges layer draws. */
export type EdgeRole = 'line' | 'markerFill' | 'markerOutline';

/** Arrowhead for positive influence, filled square for negative. */
export type MarkerType = 'Positive arrow' | 'Negative square';

/**
 * One entry per <path> in the edges layer, in document order.
 * `connections` is absent for paths the workbook does not attribute to any
 * connection (see `_meta.orphanPathIndices`), and holds more than one id where
 * a single drawn line is shared by several connections.
 */
export interface EdgePath {
  role: EdgeRole;
  connections?: string[];
  markerType?: MarkerType;
}

/** Which paths make up a connection, resolved from the geometry workbook. */
export interface ConnectionGeometry {
  sourceId: number;
  targetId: number;
  influence: Influence;
  markerType: MarkerType;
  /** Index of the line segment that terminates at the target node. */
  terminalIndex: number;
  /** Every path index belonging to this connection (line + both markers). */
  pathIndices: number[];
  /** Verbatim note from the geometry workbook about endpoint attribution. */
  mappingNote: string;
  /**
   * True when the attributed line runs the full source→target route. When
   * false, only the final leg is attributed, so highlighting is partial.
   */
  exactRoute: boolean;
}

/**
 * Which of the two node taxonomies the legend is filtering by.
 *
 * `type` is the map's own colour grouping (Media, Social, Economic …);
 * `cluster` is the Foresight atlas's classification (Physiology, Engine …).
 * They cross-cut — neither is a subdivision of the other.
 */
export type Taxonomy = 'type' | 'cluster';

/** A variable type: the map's colour grouping, with its swatch from the artwork. */
export interface VariableTypeMeta {
  name: string;
  /** Modal node fill for the type — what the printed legend shows. */
  swatch: string;
  nodeCount: number;
  /** Other fills in the type (highlighted hub nodes, outline rings). */
  accentFills: string[];
}

/**
 * An atlas cluster. Deliberately has no swatch: the artwork colours nodes by
 * variable type, so any colour here would appear nowhere on the map.
 */
export interface AtlasClusterMeta {
  name: string;
  nodeCount: number;
}

export interface EdgeGeometry {
  _meta: {
    source: string;
    description: string;
    pathCount: number;
    connectionCount: number;
    /** Paths drawn in the SVG that no connection claims. */
    orphanPathIndices: number[];
    /** Connections whose attributed line does not begin on the source box. */
    approximateRouteConnections: string[];
  };
  paths: EdgePath[];
  connections: Record<string, ConnectionGeometry>;
}
