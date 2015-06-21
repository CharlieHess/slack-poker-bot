/**
 * Copyright 2012 Akseli Palén.
 * Created 2012-07-15.
 * Licensed under the MIT license.
 *
 * <license>
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * </lisence>
 *
 * Implements functions to calculate combinations of elements in JS Arrays.
 *
 * Functions:
 *   k_combinations(set, k) -- Return all k-sized combinations in a set
 *   combinations(set) -- Return all combinations of the set
 */

module.exports =
class Combinations {
  /**
   * K-combinations
   *
   * Get k-sized combinations of elements in a set.
   *
   * Usage:
   *   k_combinations(set, k)
   *
   * Parameters:
   *   set: Array of objects of any type. They are treated as unique.
   *   k: size of combinations to search for.
   *
   * Return:
   *   Array of found combinations, size of a combination is k.
   *
   * Examples:
   *
   *   k_combinations([1, 2, 3], 1)
   *   -> [[1], [2], [3]]
   *
   *   k_combinations([1, 2, 3], 2)
   *   -> [[1,2], [1,3], [2, 3]
   *
   *   k_combinations([1, 2, 3], 3)
   *   -> [[1, 2, 3]]
   *
   *   k_combinations([1, 2, 3], 4)
   *   -> []
   *
   *   k_combinations([1, 2, 3], 0)
   *   -> []
   *
   *   k_combinations([1, 2, 3], -1)
   *   -> []
   *
   *   k_combinations([], 0)
   *   -> []
   */
  static k_combinations(set, k) {
  	var i, j, combs, head, tailcombs;

  	if (k > set.length || k <= 0) {
  		return [];
  	}

  	if (k === set.length) {
  		return [set];
  	}

  	if (k === 1) {
  		combs = [];
  		for (i = 0; i < set.length; i++) {
  			combs.push([set[i]]);
  		}
  		return combs;
  	}

  	// Assert {1 < k < set.length}

  	combs = [];
  	for (i = 0; i < set.length - k + 1; i++) {
  		head = set.slice(i, i+1);
  		tailcombs = Combinations.k_combinations(set.slice(i + 1), k - 1);
  		for (j = 0; j < tailcombs.length; j++) {
  			combs.push(head.concat(tailcombs[j]));
  		}
  	}
  	return combs;
  }


  /**
   * Combinations
   *
   * Get all possible combinations of elements in a set.
   *
   * Usage:
   *   combinations(set)
   *
   * Examples:
   *
   *   combinations([1, 2, 3])
   *   -> [[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]
   *
   *   combinations([1])
   *   -> [[1]]
   */
  static combinations(set) {
  	var k, i, combs, k_combs;
  	combs = [];

  	// Calculate all non-empty k-combinations
  	for (k = 1; k <= set.length; k++) {
  		k_combs = Combinations.k_combinations(set, k);
  		for (i = 0; i < k_combs.length; i++) {
  			combs.push(k_combs[i]);
  		}
  	}
  	return combs;
  }
};
