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

/** A legend entry: cluster name plus the swatch colour read from the artwork. */
export interface ClusterMeta {
  name: string;
  /** Modal node fill for the cluster — what the printed legend shows. */
  swatch: string;
  nodeCount: number;
  /** Other fills in the cluster (highlighted hub nodes, outline rings). */
  accentFills: string[];
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
