/**
 * ForceLayout - Force-Directed Graph Layout for Metabolic Networks
 *
 * Handles large-scale metabolic networks (1000+ nodes) with:
 * - Subsystem-based clustering
 * - Hierarchical layout
 * - Level-of-detail rendering
 * - Barnes-Hut optimization for O(n log n) force calculations
 *
 * Based on D3-force algorithms but optimized for metabolic networks.
 *
 * References:
 * - Barnes & Hut (1986) "A hierarchical O(N log N) force-calculation algorithm"
 * - Fruchterman & Reingold (1991) "Graph drawing by force-directed placement"
 */

/**
 * Force simulation for metabolic networks
 */
export class MetabolicForceLayout {
  constructor(options = {}) {
    this.width = options.width || 1200;
    this.height = options.height || 800;
    this.iterations = options.iterations || 300;

    // Force parameters
    this.repulsion = options.repulsion || -400;
    this.attraction = options.attraction || 0.01;
    this.damping = options.damping || 0.9;
    this.minDistance = options.minDistance || 30;

    // Subsystem clustering
    this.subsystemSpacing = options.subsystemSpacing || 200;
    this.clusterStrength = options.clusterStrength || 0.3;

    // Barnes-Hut threshold
    this.theta = options.theta || 0.8;

    // State
    this.nodes = [];
    this.edges = [];
    this.subsystems = new Map();
    this.quadtree = null;
  }

  /**
   * Initialize layout from model
   */
  initializeFromModel(model) {
    this.nodes = [];
    this.edges = [];
    this.subsystems = new Map();

    const reactions = model.reactions || {};
    const metabolites = model.metabolites || {};

    // Collect metabolites with their connectivity
    const metaboliteConnectivity = new Map();

    Object.entries(reactions).forEach(([rxnId, rxn]) => {
      const mets = rxn.metabolites || {};
      Object.keys(mets).forEach(metId => {
        metaboliteConnectivity.set(metId,
          (metaboliteConnectivity.get(metId) || 0) + 1
        );
      });
    });

    // Create nodes for metabolites (filter highly connected hub metabolites)
    const hubThreshold = 15; // Metabolites connected to >15 reactions are hubs
    const hubMetabolites = new Set();

    metaboliteConnectivity.forEach((count, metId) => {
      if (count > hubThreshold) {
        hubMetabolites.add(metId);
      }
    });

    // Create metabolite nodes
    metaboliteConnectivity.forEach((connectivity, metId) => {
      const met = metabolites[metId] || {};
      const isHub = hubMetabolites.has(metId);

      this.nodes.push({
        id: metId,
        type: 'metabolite',
        label: met.name || metId.replace(/_[cepx]$/, ''),
        compartment: met.compartment || 'c',
        connectivity,
        isHub,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: 0,
        vy: 0,
        fx: null, // Fixed position (if pinned)
        fy: null
      });
    });

    // Create edges (reactions)
    Object.entries(reactions).forEach(([rxnId, rxn]) => {
      const mets = rxn.metabolites || {};
      const reactants = [];
      const products = [];

      Object.entries(mets).forEach(([metId, coeff]) => {
        if (coeff < 0) reactants.push(metId);
        else products.push(metId);
      });

      // Create edges from reactants to products (skip hub metabolites in edges)
      reactants.forEach(r => {
        products.forEach(p => {
          if (!hubMetabolites.has(r) && !hubMetabolites.has(p)) {
            this.edges.push({
              source: r,
              target: p,
              reaction: rxnId,
              subsystem: rxn.subsystem || 'Unclassified'
            });
          }
        });
      });

      // Track subsystems
      const subsystem = rxn.subsystem || 'Unclassified';
      if (!this.subsystems.has(subsystem)) {
        this.subsystems.set(subsystem, []);
      }
      reactants.concat(products).forEach(metId => {
        if (!hubMetabolites.has(metId)) {
          const arr = this.subsystems.get(subsystem);
          if (!arr.includes(metId)) arr.push(metId);
        }
      });
    });

    // Assign subsystem centers
    this.assignSubsystemPositions();

    return this;
  }

  /**
   * Assign initial positions based on subsystems
   */
  assignSubsystemPositions() {
    const subsystemList = Array.from(this.subsystems.keys());
    const cols = Math.ceil(Math.sqrt(subsystemList.length));
    const rows = Math.ceil(subsystemList.length / cols);

    const cellWidth = this.width / cols;
    const cellHeight = this.height / rows;

    const subsystemCenters = new Map();

    subsystemList.forEach((subsystem, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cx = (col + 0.5) * cellWidth;
      const cy = (row + 0.5) * cellHeight;
      subsystemCenters.set(subsystem, { x: cx, y: cy });
    });

    // Position nodes near their subsystem center
    this.nodes.forEach(node => {
      // Find which subsystem this node belongs to
      for (const [subsystem, metIds] of this.subsystems) {
        if (metIds.includes(node.id)) {
          const center = subsystemCenters.get(subsystem);
          if (center) {
            node.x = center.x + (Math.random() - 0.5) * cellWidth * 0.8;
            node.y = center.y + (Math.random() - 0.5) * cellHeight * 0.8;
            node.subsystem = subsystem;
            node.subsystemCenter = center;
          }
          break;
        }
      }
    });
  }

  /**
   * Build quadtree for Barnes-Hut approximation
   */
  buildQuadtree() {
    // Simple quadtree implementation
    const bounds = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height
    };

    this.quadtree = this.createQuadNode(bounds);

    this.nodes.forEach(node => {
      this.insertQuadNode(this.quadtree, node);
    });
  }

  createQuadNode(bounds) {
    return {
      bounds,
      nodes: [],
      children: null,
      mass: 0,
      cx: 0,
      cy: 0
    };
  }

  insertQuadNode(quad, node) {
    if (!this.inBounds(node, quad.bounds)) return;

    if (quad.children === null) {
      quad.nodes.push(node);

      // Subdivide if too many nodes
      if (quad.nodes.length > 4) {
        this.subdivide(quad);
      }
    } else {
      // Insert into appropriate child
      for (const child of quad.children) {
        if (this.inBounds(node, child.bounds)) {
          this.insertQuadNode(child, node);
          break;
        }
      }
    }

    // Update center of mass
    quad.mass++;
    quad.cx = (quad.cx * (quad.mass - 1) + node.x) / quad.mass;
    quad.cy = (quad.cy * (quad.mass - 1) + node.y) / quad.mass;
  }

  subdivide(quad) {
    const { x, y, width, height } = quad.bounds;
    const hw = width / 2;
    const hh = height / 2;

    quad.children = [
      this.createQuadNode({ x, y, width: hw, height: hh }),
      this.createQuadNode({ x: x + hw, y, width: hw, height: hh }),
      this.createQuadNode({ x, y: y + hh, width: hw, height: hh }),
      this.createQuadNode({ x: x + hw, y: y + hh, width: hw, height: hh })
    ];

    // Redistribute nodes
    quad.nodes.forEach(node => {
      for (const child of quad.children) {
        if (this.inBounds(node, child.bounds)) {
          this.insertQuadNode(child, node);
          break;
        }
      }
    });

    quad.nodes = [];
  }

  inBounds(node, bounds) {
    return node.x >= bounds.x && node.x < bounds.x + bounds.width &&
           node.y >= bounds.y && node.y < bounds.y + bounds.height;
  }

  /**
   * Calculate repulsion force using Barnes-Hut
   */
  calculateRepulsion(node, quad) {
    if (!quad || quad.mass === 0) return { fx: 0, fy: 0 };

    const dx = node.x - quad.cx;
    const dy = node.y - quad.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Barnes-Hut criterion
    const size = Math.max(quad.bounds.width, quad.bounds.height);

    if (quad.children === null || size / dist < this.theta) {
      // Treat as single body
      if (dist < this.minDistance) {
        return { fx: 0, fy: 0 };
      }

      const force = this.repulsion * quad.mass / (dist * dist);
      return {
        fx: force * dx / dist,
        fy: force * dy / dist
      };
    }

    // Recurse into children
    let fx = 0, fy = 0;
    for (const child of quad.children) {
      const f = this.calculateRepulsion(node, child);
      fx += f.fx;
      fy += f.fy;
    }

    return { fx, fy };
  }

  /**
   * Run one iteration of the simulation
   */
  tick() {
    // Build quadtree for efficient repulsion
    this.buildQuadtree();

    // Calculate forces
    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    // Repulsion (Barnes-Hut)
    this.nodes.forEach(node => {
      const f = this.calculateRepulsion(node, this.quadtree);
      node.vx += f.fx;
      node.vy += f.fy;
    });

    // Attraction (edges)
    this.edges.forEach(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist === 0) return;

      const force = dist * this.attraction;
      const fx = force * dx / dist;
      const fy = force * dy / dist;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });

    // Subsystem clustering force
    this.nodes.forEach(node => {
      if (node.subsystemCenter) {
        const dx = node.subsystemCenter.x - node.x;
        const dy = node.subsystemCenter.y - node.y;
        node.vx += dx * this.clusterStrength * 0.01;
        node.vy += dy * this.clusterStrength * 0.01;
      }
    });

    // Update positions
    this.nodes.forEach(node => {
      if (node.fx !== null) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.vx *= this.damping;
        node.x += node.vx;
      }

      if (node.fy !== null) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.vy *= this.damping;
        node.y += node.vy;
      }

      // Boundary constraints
      node.x = Math.max(20, Math.min(this.width - 20, node.x));
      node.y = Math.max(20, Math.min(this.height - 20, node.y));
    });
  }

  /**
   * Run full simulation
   */
  run(onProgress = null) {
    for (let i = 0; i < this.iterations; i++) {
      this.tick();

      // Reduce forces over time (simulated annealing)
      this.repulsion *= 0.99;
      this.attraction *= 1.001;

      if (onProgress && i % 10 === 0) {
        onProgress(i / this.iterations);
      }
    }

    return this.getResult();
  }

  /**
   * Run simulation asynchronously with progress updates
   */
  async runAsync(onProgress = null) {
    return new Promise(resolve => {
      let i = 0;

      const step = () => {
        const batchSize = 10;
        for (let j = 0; j < batchSize && i < this.iterations; j++, i++) {
          this.tick();
          this.repulsion *= 0.99;
          this.attraction *= 1.001;
        }

        if (onProgress) {
          onProgress(i / this.iterations);
        }

        if (i < this.iterations) {
          requestAnimationFrame(step);
        } else {
          resolve(this.getResult());
        }
      };

      requestAnimationFrame(step);
    });
  }

  /**
   * Get layout result
   */
  getResult() {
    return {
      nodes: this.nodes.map(n => ({
        id: n.id,
        x: n.x,
        y: n.y,
        label: n.label,
        type: n.type,
        connectivity: n.connectivity,
        isHub: n.isHub,
        subsystem: n.subsystem,
        compartment: n.compartment
      })),
      edges: this.edges.map(e => ({
        from: e.source,
        to: e.target,
        reaction: e.reaction,
        subsystem: e.subsystem
      })),
      subsystems: Array.from(this.subsystems.keys()),
      bounds: {
        width: this.width,
        height: this.height
      }
    };
  }

  /**
   * Get subsystem view (collapsed)
   */
  getSubsystemView() {
    const subsystemNodes = [];
    const subsystemEdges = [];
    const subsystemSizes = new Map();

    // Create subsystem nodes
    this.subsystems.forEach((metIds, subsystem) => {
      // Calculate center of subsystem
      let cx = 0, cy = 0, count = 0;
      this.nodes.forEach(n => {
        if (n.subsystem === subsystem) {
          cx += n.x;
          cy += n.y;
          count++;
        }
      });

      if (count > 0) {
        subsystemNodes.push({
          id: subsystem,
          x: cx / count,
          y: cy / count,
          label: subsystem,
          type: 'subsystem',
          size: count
        });
        subsystemSizes.set(subsystem, count);
      }
    });

    // Create edges between subsystems
    const edgeSet = new Set();
    this.edges.forEach(e => {
      const sourceNode = this.nodes.find(n => n.id === e.source);
      const targetNode = this.nodes.find(n => n.id === e.target);

      if (sourceNode?.subsystem && targetNode?.subsystem &&
          sourceNode.subsystem !== targetNode.subsystem) {
        const edgeKey = [sourceNode.subsystem, targetNode.subsystem].sort().join('|');
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          subsystemEdges.push({
            from: sourceNode.subsystem,
            to: targetNode.subsystem
          });
        }
      }
    });

    return {
      nodes: subsystemNodes,
      edges: subsystemEdges
    };
  }

  /**
   * Get detailed view of a specific subsystem
   */
  getSubsystemDetail(subsystemId) {
    const metIds = this.subsystems.get(subsystemId) || [];
    const nodeSet = new Set(metIds);

    return {
      nodes: this.nodes.filter(n => nodeSet.has(n.id)).map(n => ({
        id: n.id,
        x: n.x,
        y: n.y,
        label: n.label,
        type: n.type,
        connectivity: n.connectivity
      })),
      edges: this.edges.filter(e =>
        nodeSet.has(e.source) && nodeSet.has(e.target)
      ).map(e => ({
        from: e.source,
        to: e.target,
        reaction: e.reaction
      }))
    };
  }
}

export default MetabolicForceLayout;
