/**
 * EventQueue is a priority queue for events.
 * Events are dequeued in order of significance (highest first).
 * Uses a binary max-heap for O(log n) enqueue/dequeue.
 */

import type { WorldEvent } from './types.js';

export class EventQueue {
  private heap: WorldEvent[] = [];

  /**
   * Add an event to the queue.
   * O(log n) complexity.
   */
  enqueue(event: WorldEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the highest significance event.
   * O(log n) complexity.
   */
  dequeue(): WorldEvent | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }

    const max = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return max;
  }

  /**
   * View the highest significance event without removing it.
   */
  peek(): WorldEvent | undefined {
    return this.heap[0];
  }

  /**
   * Get the number of events in the queue.
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Check if the queue is empty.
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Remove and return all events, ordered by significance descending.
   */
  drain(): WorldEvent[] {
    const result: WorldEvent[] = [];
    while (this.heap.length > 0) {
      const event = this.dequeue();
      if (event !== undefined) {
        result.push(event);
      }
    }
    return result;
  }

  /**
   * Clear all events from the queue.
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Bubble up the element at index to maintain heap property.
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const parent = this.heap[parentIndex];

      if (current === undefined || parent === undefined) {
        break;
      }

      // Max heap: parent should have higher or equal significance
      if (parent.significance >= current.significance) {
        break;
      }

      // Swap
      this.heap[index] = parent;
      this.heap[parentIndex] = current;
      index = parentIndex;
    }
  }

  /**
   * Bubble down the element at index to maintain heap property.
   */
  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let largest = index;

      const current = this.heap[index];
      const left = this.heap[leftChild];
      const right = this.heap[rightChild];

      if (current === undefined) {
        break;
      }

      if (leftChild < length && left !== undefined && left.significance > current.significance) {
        largest = leftChild;
      }

      const largestEvent = this.heap[largest];
      if (
        rightChild < length &&
        right !== undefined &&
        largestEvent !== undefined &&
        right.significance > largestEvent.significance
      ) {
        largest = rightChild;
      }

      if (largest === index) {
        break;
      }

      // Swap
      const largestValue = this.heap[largest];
      if (largestValue !== undefined) {
        this.heap[index] = largestValue;
        this.heap[largest] = current;
      }
      index = largest;
    }
  }
}
