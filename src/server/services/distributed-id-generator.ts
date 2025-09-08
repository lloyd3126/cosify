/**
 * Distributed ID Generator Service
 * 
 * Implements Snowflake-like distributed ID generation for multi-instance deployments
 * Ensures unique ID generation across multiple application instances and datacenters
 */

export interface DistributedIdConfig {
    nodeId: number;           // 0-1023 (10 bits)
    datacenter: number;       // 0-31 (5 bits)
    epoch?: number;           // Custom epoch timestamp
    clockBackwardsThreshold?: number; // Max allowed clock backwards in ms
}

export interface ParsedId {
    timestamp: number;
    datacenter: number;
    nodeId: number;
    sequence: number;
}

/**
 * Snowflake-inspired distributed ID generator
 * 
 * 64-bit ID structure:
 * - 1 bit: sign (always 0)
 * - 41 bits: timestamp (milliseconds since epoch)
 * - 5 bits: datacenter ID
 * - 10 bits: node ID  
 * - 12 bits: sequence number
 */
export class DistributedIdGenerator {
    private static readonly EPOCH_DEFAULT = new Date('2024-01-01T00:00:00Z').getTime();

    // Bit lengths
    private static readonly DATACENTER_BITS = 5;
    private static readonly NODE_BITS = 10;
    private static readonly SEQUENCE_BITS = 12;

    // Max values
    private static readonly MAX_DATACENTER = (1 << DistributedIdGenerator.DATACENTER_BITS) - 1; // 31
    private static readonly MAX_NODE = (1 << DistributedIdGenerator.NODE_BITS) - 1; // 1023
    private static readonly MAX_SEQUENCE = (1 << DistributedIdGenerator.SEQUENCE_BITS) - 1; // 4095

    // Bit shifts
    private static readonly NODE_SHIFT = DistributedIdGenerator.SEQUENCE_BITS;
    private static readonly DATACENTER_SHIFT = DistributedIdGenerator.SEQUENCE_BITS + DistributedIdGenerator.NODE_BITS;
    private static readonly TIMESTAMP_SHIFT = DistributedIdGenerator.SEQUENCE_BITS + DistributedIdGenerator.NODE_BITS + DistributedIdGenerator.DATACENTER_BITS;

    private readonly nodeId: number;
    private readonly datacenter: number;
    private readonly epoch: number;
    private readonly clockBackwardsThreshold: number;

    private sequence = 0;
    private lastTimestamp = -1;

    constructor(config: DistributedIdConfig) {
        this.validateConfig(config);

        this.nodeId = config.nodeId;
        this.datacenter = config.datacenter;
        this.epoch = config.epoch ?? DistributedIdGenerator.EPOCH_DEFAULT;
        this.clockBackwardsThreshold = config.clockBackwardsThreshold ?? 5000; // 5 seconds default
    }

    private validateConfig(config: DistributedIdConfig): void {
        if (config.nodeId < 0 || config.nodeId > DistributedIdGenerator.MAX_NODE) {
            throw new Error(`Node ID must be between 0 and ${DistributedIdGenerator.MAX_NODE}`);
        }

        if (config.datacenter < 0 || config.datacenter > DistributedIdGenerator.MAX_DATACENTER) {
            throw new Error(`Datacenter ID must be between 0 and ${DistributedIdGenerator.MAX_DATACENTER}`);
        }
    }

    /**
     * Generate a new distributed ID
     */
    generate(): string {
        let timestamp = this.getCurrentTimestamp();

        // Handle clock backwards scenario
        if (timestamp < this.lastTimestamp) {
            const clockDiff = this.lastTimestamp - timestamp;

            if (clockDiff > this.clockBackwardsThreshold) {
                throw new Error(`Clock moved backwards by ${clockDiff}ms, which exceeds threshold of ${this.clockBackwardsThreshold}ms`);
            }

            // For small clock backwards, wait until we catch up
            timestamp = this.lastTimestamp;
        }

        // Same millisecond - increment sequence
        if (timestamp === this.lastTimestamp) {
            this.sequence = (this.sequence + 1) & DistributedIdGenerator.MAX_SEQUENCE;

            // Sequence overflow - wait for next millisecond
            if (this.sequence === 0) {
                timestamp = this.waitNextMillisecond(this.lastTimestamp);
            }
        } else {
            // New millisecond - reset sequence
            this.sequence = 0;
        }

        this.lastTimestamp = timestamp;

        // Build the ID using BigInt for proper 64-bit handling
        const timestampPart = BigInt(timestamp - this.epoch) << BigInt(DistributedIdGenerator.TIMESTAMP_SHIFT);
        const datacenterPart = BigInt(this.datacenter) << BigInt(DistributedIdGenerator.DATACENTER_SHIFT);
        const nodePart = BigInt(this.nodeId) << BigInt(DistributedIdGenerator.NODE_SHIFT);
        const sequencePart = BigInt(this.sequence);

        const id = timestampPart | datacenterPart | nodePart | sequencePart;

        return id.toString();
    }

    /**
     * Parse a distributed ID into its components
     */
    parseId(id: string): ParsedId {
        const idBigInt = BigInt(id);

        const sequence = Number(idBigInt & BigInt(DistributedIdGenerator.MAX_SEQUENCE));
        const nodeId = Number((idBigInt >> BigInt(DistributedIdGenerator.NODE_SHIFT)) & BigInt(DistributedIdGenerator.MAX_NODE));
        const datacenter = Number((idBigInt >> BigInt(DistributedIdGenerator.DATACENTER_SHIFT)) & BigInt(DistributedIdGenerator.MAX_DATACENTER));
        const timestamp = Number(idBigInt >> BigInt(DistributedIdGenerator.TIMESTAMP_SHIFT)) + this.epoch;

        return {
            timestamp,
            datacenter,
            nodeId,
            sequence
        };
    }

    /**
     * Validate if a string is a valid distributed ID
     */
    isValid(id: string): boolean {
        if (typeof id !== 'string' || id.length === 0) {
            return false;
        }

        // Check if it's a valid numeric string
        if (!/^\d+$/.test(id)) {
            return false;
        }

        try {
            // Try to parse it
            const parsed = this.parseId(id);

            // Validate components are within valid ranges
            return (
                parsed.nodeId >= 0 && parsed.nodeId <= DistributedIdGenerator.MAX_NODE &&
                parsed.datacenter >= 0 && parsed.datacenter <= DistributedIdGenerator.MAX_DATACENTER &&
                parsed.sequence >= 0 && parsed.sequence <= DistributedIdGenerator.MAX_SEQUENCE &&
                parsed.timestamp > this.epoch
            );
        } catch {
            return false;
        }
    }

    /**
     * Get current timestamp
     */
    private getCurrentTimestamp(): number {
        return Date.now();
    }

    /**
     * Wait for next millisecond
     */
    private waitNextMillisecond(lastTimestamp: number): number {
        let timestamp = this.getCurrentTimestamp();

        while (timestamp <= lastTimestamp) {
            timestamp = this.getCurrentTimestamp();
        }

        return timestamp;
    }

    /**
     * Get generator info
     */
    getInfo(): {
        nodeId: number;
        datacenter: number;
        epoch: number;
        maxSequence: number;
        maxNode: number;
        maxDatacenter: number;
    } {
        return {
            nodeId: this.nodeId,
            datacenter: this.datacenter,
            epoch: this.epoch,
            maxSequence: DistributedIdGenerator.MAX_SEQUENCE,
            maxNode: DistributedIdGenerator.MAX_NODE,
            maxDatacenter: DistributedIdGenerator.MAX_DATACENTER
        };
    }

    /**
     * Static method for creating instances with auto-configuration
     */
    static createAutoConfigured(nodeId?: number): DistributedIdGenerator {
        return new DistributedIdGenerator({
            nodeId: nodeId ?? Math.floor(Math.random() * DistributedIdGenerator.MAX_NODE),
            datacenter: 0 // Default datacenter for single-DC deployments
        });
    }
}
