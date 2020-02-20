  ////  picturefil

  /*! picturefill - v3.0.2 - 2016-02-12
 * https://scottjehl.github.io/picturefill/
 * Copyright (c) 2016 https://github.com/scottjehl/picturefill/blob/master/Authors.txt; Licensed MIT
 */
/*! Gecko-Picture - v1.0
 * https://github.com/scottjehl/picturefill/tree/3.0/src/plugins/gecko-picture
 * Firefox's early picture implementation (prior to FF41) is static and does
 * not react to viewport changes. This tiny module fixes this.
 */
(function(window) {
	/*jshint eqnull:true */
	var ua = navigator.userAgent;

	if ( window.HTMLPictureElement && ((/ecko/).test(ua) && ua.match(/rv\:(\d+)/) && RegExp.$1 < 45) ) {
		addEventListener("resize", (function() {
			var timer;

			var dummySrc = document.createElement("source");

			var fixRespimg = function(img) {
				var source, sizes;
				var picture = img.parentNode;

				if (picture.nodeName.toUpperCase() === "PICTURE") {
					source = dummySrc.cloneNode();

					picture.insertBefore(source, picture.firstElementChild);
					setTimeout(function() {
						picture.removeChild(source);
					});
				} else if (!img._pfLastSize || img.offsetWidth > img._pfLastSize) {
					img._pfLastSize = img.offsetWidth;
					sizes = img.sizes;
					img.sizes += ",100vw";
					setTimeout(function() {
						img.sizes = sizes;
					});
				}
			};

			var findPictureImgs = function() {
				var i;
				var imgs = document.querySelectorAll("picture > img, img[srcset][sizes]");
				for (i = 0; i < imgs.length; i++) {
					fixRespimg(imgs[i]);
				}
			};
			var onResize = function() {
				clearTimeout(timer);
				timer = setTimeout(findPictureImgs, 99);
			};
			var mq = window.matchMedia && matchMedia("(orientation: landscape)");
			var init = function() {
				onResize();

				if (mq && mq.addListener) {
					mq.addListener(onResize);
				}
			};

			dummySrc.srcset = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

			if (/^[c|i]|d$/.test(document.readyState || "")) {
				init();
			} else {
				document.addEventListener("DOMContentLoaded", init);
			}

			return onResize;
		})());
	}
})(window);

/*! Picturefill - v3.0.2
 * http://scottjehl.github.io/picturefill
 * Copyright (c) 2015 https://github.com/scottjehl/picturefill/blob/master/Authors.txt;
 *  License: MIT
 */

(function( window, document, undefined ) {
	// Enable strict mode
	"use strict";

	// HTML shim|v it for old IE (IE9 will still need the HTML video tag workaround)
	document.createElement( "picture" );

	var warn, eminpx, alwaysCheckWDescriptor, evalId;
	// local object for method references and testing exposure
	var pf = {};
	var isSupportTestReady = false;
	var noop = function() {};
	var image = document.createElement( "img" );
	var getImgAttr = image.getAttribute;
	var setImgAttr = image.setAttribute;
	var removeImgAttr = image.removeAttribute;
	var docElem = document.documentElement;
	var types = {};
	var cfg = {
		//resource selection:
		algorithm: ""
	};
	var srcAttr = "data-pfsrc";
	var srcsetAttr = srcAttr + "set";
	// ua sniffing is done for undetectable img loading features,
	// to do some non crucial perf optimizations
	var ua = navigator.userAgent;
	var supportAbort = (/rident/).test(ua) || ((/ecko/).test(ua) && ua.match(/rv\:(\d+)/) && RegExp.$1 > 35 );
	var curSrcProp = "currentSrc";
	var regWDesc = /\s+\+?\d+(e\d+)?w/;
	var regSize = /(\([^)]+\))?\s*(.+)/;
	var setOptions = window.picturefillCFG;
	/**
	 * Shortcut property for https://w3c.github.io/webappsec/specs/mixedcontent/#restricts-mixed-content ( for easy overriding in tests )
	 */
	// baseStyle also used by getEmValue (i.e.: width: 1em is important)
	var baseStyle = "position:absolute;left:0;visibility:hidden;display:block;padding:0;border:none;font-size:1em;width:1em;overflow:hidden;clip:rect(0px, 0px, 0px, 0px)";
	var fsCss = "font-size:100%!important;";
	var isVwDirty = true;

	var cssCache = {};
	var sizeLengthCache = {};
	var DPR = window.devicePixelRatio;
	var units = {
		px: 1,
		"in": 96
	};
	var anchor = document.createElement( "a" );
	/**
	 * alreadyRun flag used for setOptions. is it true setOptions will reevaluate
	 * @type {boolean}
	 */
	var alreadyRun = false;

	// Reusable, non-"g" Regexes

	// (Don't use \s, to avoid matching non-breaking space.)
	var regexLeadingSpaces = /^[ \t\n\r\u000c]+/,
	    regexLeadingCommasOrSpaces = /^[, \t\n\r\u000c]+/,
	    regexLeadingNotSpaces = /^[^ \t\n\r\u000c]+/,
	    regexTrailingCommas = /[,]+$/,
	    regexNonNegativeInteger = /^\d+$/,

	    // ( Positive or negative or unsigned integers or decimals, without or without exponents.
	    // Must include at least one digit.
	    // According to spec tests any decimal point must be followed by a digit.
	    // No leading plus sign is allowed.)
	    // https://html.spec.whatwg.org/multipage/infrastructure.html#valid-floating-point-number
	    regexFloatingPoint = /^-?(?:[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;

	var on = function(obj, evt, fn, capture) {
		if ( obj.addEventListener ) {
			obj.addEventListener(evt, fn, capture || false);
		} else if ( obj.attachEvent ) {
			obj.attachEvent( "on" + evt, fn);
		}
	};

	/**
	 * simple memoize function:
	 */

	var memoize = function(fn) {
		var cache = {};
		return function(input) {
			if ( !(input in cache) ) {
				cache[ input ] = fn(input);
			}
			return cache[ input ];
		};
	};

	// UTILITY FUNCTIONS

	// Manual is faster than RegEx
	// http://jsperf.com/whitespace-character/5
	function isSpace(c) {
		return (c === "\u0020" || // space
		        c === "\u0009" || // horizontal tab
		        c === "\u000A" || // new line
		        c === "\u000C" || // form feed
		        c === "\u000D");  // carriage return
	}

	/**
	 * gets a mediaquery and returns a boolean or gets a css length and returns a number
	 * @param css mediaqueries or css length
	 * @returns {boolean|number}
	 *
	 * based on: https://gist.github.com/jonathantneal/db4f77009b155f083738
	 */
	var evalCSS = (function() {

		var regLength = /^([\d\.]+)(em|vw|px)$/;
		var replace = function() {
			var args = arguments, index = 0, string = args[0];
			while (++index in args) {
				string = string.replace(args[index], args[++index]);
			}
			return string;
		};

		var buildStr = memoize(function(css) {

			return "return " + replace((css || "").toLowerCase(),
				// interpret `and`
				/\band\b/g, "&&",

				// interpret `,`
				/,/g, "||",

				// interpret `min-` as >=
				/min-([a-z-\s]+):/g, "e.$1>=",

				// interpret `max-` as <=
				/max-([a-z-\s]+):/g, "e.$1<=",

				//calc value
				/calc([^)]+)/g, "($1)",

				// interpret css values
				/(\d+[\.]*[\d]*)([a-z]+)/g, "($1 * e.$2)",
				//make eval less evil
				/^(?!(e.[a-z]|[0-9\.&=|><\+\-\*\(\)\/])).*/ig, ""
			) + ";";
		});

		return function(css, length) {
			var parsedLength;
			if (!(css in cssCache)) {
				cssCache[css] = false;
				if (length && (parsedLength = css.match( regLength ))) {
					cssCache[css] = parsedLength[ 1 ] * units[parsedLength[ 2 ]];
				} else {
					/*jshint evil:true */
					try{
						cssCache[css] = new Function("e", buildStr(css))(units);
					} catch(e) {}
					/*jshint evil:false */
				}
			}
			return cssCache[css];
		};
	})();

	var setResolution = function( candidate, sizesattr ) {
		if ( candidate.w ) { // h = means height: || descriptor.type === 'h' do not handle yet...
			candidate.cWidth = pf.calcListLength( sizesattr || "100vw" );
			candidate.res = candidate.w / candidate.cWidth ;
		} else {
			candidate.res = candidate.d;
		}
		return candidate;
	};

	/**
	 *
	 * @param opt
	 */
	var picturefill = function( opt ) {

		if (!isSupportTestReady) {return;}

		var elements, i, plen;

		var options = opt || {};

		if ( options.elements && options.elements.nodeType === 1 ) {
			if ( options.elements.nodeName.toUpperCase() === "IMG" ) {
				options.elements =  [ options.elements ];
			} else {
				options.context = options.elements;
				options.elements =  null;
			}
		}

		elements = options.elements || pf.qsa( (options.context || document), ( options.reevaluate || options.reselect ) ? pf.sel : pf.selShort );

		if ( (plen = elements.length) ) {

			pf.setupRun( options );
			alreadyRun = true;

			// Loop through all elements
			for ( i = 0; i < plen; i++ ) {
				pf.fillImg(elements[ i ], options);
			}

			pf.teardownRun( options );
		}
	};

	/**
	 * outputs a warning for the developer
	 * @param {message}
	 * @type {Function}
	 */
	warn = ( window.console && console.warn ) ?
		function( message ) {
			console.warn( message );
		} :
		noop
	;

	if ( !(curSrcProp in image) ) {
		curSrcProp = "src";
	}

	// Add support for standard mime types.
	types[ "image/jpeg" ] = true;
	types[ "image/gif" ] = true;
	types[ "image/png" ] = true;

	function detectTypeSupport( type, typeUri ) {
		// based on Modernizr's lossless img-webp test
		// note: asynchronous
		var image = new window.Image();
		image.onerror = function() {
			types[ type ] = false;
			picturefill();
		};
		image.onload = function() {
			types[ type ] = image.width === 1;
			picturefill();
		};
		image.src = typeUri;
		return "pending";
	}

	// test svg support
	types[ "image/svg+xml" ] = document.implementation.hasFeature( "http://www.w3.org/TR/SVG11/feature#Image", "1.1" );

	/**
	 * updates the internal vW property with the current viewport width in px
	 */
	function updateMetrics() {

		isVwDirty = false;
		DPR = window.devicePixelRatio;
		cssCache = {};
		sizeLengthCache = {};

		pf.DPR = DPR || 1;

		units.width = Math.max(window.innerWidth || 0, docElem.clientWidth);
		units.height = Math.max(window.innerHeight || 0, docElem.clientHeight);

		units.vw = units.width / 100;
		units.vh = units.height / 100;

		evalId = [ units.height, units.width, DPR ].join("-");

		units.em = pf.getEmValue();
		units.rem = units.em;
	}

	function chooseLowRes( lowerValue, higherValue, dprValue, isCached ) {
		var bonusFactor, tooMuch, bonus, meanDensity;

		//experimental
		if (cfg.algorithm === "saveData" ){
			if ( lowerValue > 2.7 ) {
				meanDensity = dprValue + 1;
			} else {
				tooMuch = higherValue - dprValue;
				bonusFactor = Math.pow(lowerValue - 0.6, 1.5);

				bonus = tooMuch * bonusFactor;

				if (isCached) {
					bonus += 0.1 * bonusFactor;
				}

				meanDensity = lowerValue + bonus;
			}
		} else {
			meanDensity = (dprValue > 1) ?
				Math.sqrt(lowerValue * higherValue) :
				lowerValue;
		}

		return meanDensity > dprValue;
	}

	function applyBestCandidate( img ) {
		var srcSetCandidates;
		var matchingSet = pf.getSet( img );
		var evaluated = false;
		if ( matchingSet !== "pending" ) {
			evaluated = evalId;
			if ( matchingSet ) {
				srcSetCandidates = pf.setRes( matchingSet );
				pf.applySetCandidate( srcSetCandidates, img );
			}
		}
		img[ pf.ns ].evaled = evaluated;
	}

	function ascendingSort( a, b ) {
		return a.res - b.res;
	}

	function setSrcToCur( img, src, set ) {
		var candidate;
		if ( !set && src ) {
			set = img[ pf.ns ].sets;
			set = set && set[set.length - 1];
		}

		candidate = getCandidateForSrc(src, set);

		if ( candidate ) {
			src = pf.makeUrl(src);
			img[ pf.ns ].curSrc = src;
			img[ pf.ns ].curCan = candidate;

			if ( !candidate.res ) {
				setResolution( candidate, candidate.set.sizes );
			}
		}
		return candidate;
	}

	function getCandidateForSrc( src, set ) {
		var i, candidate, candidates;
		if ( src && set ) {
			candidates = pf.parseSet( set );
			src = pf.makeUrl(src);
			for ( i = 0; i < candidates.length; i++ ) {
				if ( src === pf.makeUrl(candidates[ i ].url) ) {
					candidate = candidates[ i ];
					break;
				}
			}
		}
		return candidate;
	}

	function getAllSourceElements( picture, candidates ) {
		var i, len, source, srcset;

		// SPEC mismatch intended for size and perf:
		// actually only source elements preceding the img should be used
		// also note: don't use qsa here, because IE8 sometimes doesn't like source as the key part in a selector
		var sources = picture.getElementsByTagName( "source" );

		for ( i = 0, len = sources.length; i < len; i++ ) {
			source = sources[ i ];
			source[ pf.ns ] = true;
			srcset = source.getAttribute( "srcset" );

			// if source does not have a srcset attribute, skip
			if ( srcset ) {
				candidates.push( {
					srcset: srcset,
					media: source.getAttribute( "media" ),
					type: source.getAttribute( "type" ),
					sizes: source.getAttribute( "sizes" )
				} );
			}
		}
	}

	/**
	 * Srcset Parser
	 * By Alex Bell |  MIT License
	 *
	 * @returns Array [{url: _, d: _, w: _, h:_, set:_(????)}, ...]
	 *
	 * Based super duper closely on the reference algorithm at:
	 * https://html.spec.whatwg.org/multipage/embedded-content.html#parse-a-srcset-attribute
	 */

	// 1. Let input be the value passed to this algorithm.
	// (TO-DO : Explain what "set" argument is here. Maybe choose a more
	// descriptive & more searchable name.  Since passing the "set" in really has
	// nothing to do with parsing proper, I would prefer this assignment eventually
	// go in an external fn.)
	function parseSrcset(input, set) {

		function collectCharacters(regEx) {
			var chars,
			    match = regEx.exec(input.substring(pos));
			if (match) {
				chars = match[ 0 ];
				pos += chars.length;
				return chars;
			}
		}

		var inputLength = input.length,
		    url,
		    descriptors,
		    currentDescriptor,
		    state,
		    c,

		    // 2. Let position be a pointer into input, initially pointing at the start
		    //    of the string.
		    pos = 0,

		    // 3. Let candidates be an initially empty source set.
		    candidates = [];

		/**
		* Adds descriptor properties to a candidate, pushes to the candidates array
		* @return undefined
		*/
		// (Declared outside of the while loop so that it's only created once.
		// (This fn is defined before it is used, in order to pass JSHINT.
		// Unfortunately this breaks the sequencing of the spec comments. :/ )
		function parseDescriptors() {

			// 9. Descriptor parser: Let error be no.
			var pError = false,

			// 10. Let width be absent.
			// 11. Let density be absent.
			// 12. Let future-compat-h be absent. (We're implementing it now as h)
			    w, d, h, i,
			    candidate = {},
			    desc, lastChar, value, intVal, floatVal;

			// 13. For each descriptor in descriptors, run the appropriate set of steps
			// from the following list:
			for (i = 0 ; i < descriptors.length; i++) {
				desc = descriptors[ i ];

				lastChar = desc[ desc.length - 1 ];
				value = desc.substring(0, desc.length - 1);
				intVal = parseInt(value, 10);
				floatVal = parseFloat(value);

				// If the descriptor consists of a valid non-negative integer followed by
				// a U+0077 LATIN SMALL LETTER W character
				if (regexNonNegativeInteger.test(value) && (lastChar === "w")) {

					// If width and density are not both absent, then let error be yes.
					if (w || d) {pError = true;}

					// Apply the rules for parsing non-negative integers to the descriptor.
					// If the result is zero, let error be yes.
					// Otherwise, let width be the result.
					if (intVal === 0) {pError = true;} else {w = intVal;}

				// If the descriptor consists of a valid floating-point number followed by
				// a U+0078 LATIN SMALL LETTER X character
				} else if (regexFloatingPoint.test(value) && (lastChar === "x")) {

					// If width, density and future-compat-h are not all absent, then let error
					// be yes.
					if (w || d || h) {pError = true;}

					// Apply the rules for parsing floating-point number values to the descriptor.
					// If the result is less than zero, let error be yes. Otherwise, let density
					// be the result.
					if (floatVal < 0) {pError = true;} else {d = floatVal;}

				// If the descriptor consists of a valid non-negative integer followed by
				// a U+0068 LATIN SMALL LETTER H character
				} else if (regexNonNegativeInteger.test(value) && (lastChar === "h")) {

					// If height and density are not both absent, then let error be yes.
					if (h || d) {pError = true;}

					// Apply the rules for parsing non-negative integers to the descriptor.
					// If the result is zero, let error be yes. Otherwise, let future-compat-h
					// be the result.
					if (intVal === 0) {pError = true;} else {h = intVal;}

				// Anything else, Let error be yes.
				} else {pError = true;}
			} // (close step 13 for loop)

			// 15. If error is still no, then append a new image source to candidates whose
			// URL is url, associated with a width width if not absent and a pixel
			// density density if not absent. Otherwise, there is a parse error.
			if (!pError) {
				candidate.url = url;

				if (w) { candidate.w = w;}
				if (d) { candidate.d = d;}
				if (h) { candidate.h = h;}
				if (!h && !d && !w) {candidate.d = 1;}
				if (candidate.d === 1) {set.has1x = true;}
				candidate.set = set;

				candidates.push(candidate);
			}
		} // (close parseDescriptors fn)

		/**
		* Tokenizes descriptor properties prior to parsing
		* Returns undefined.
		* (Again, this fn is defined before it is used, in order to pass JSHINT.
		* Unfortunately this breaks the logical sequencing of the spec comments. :/ )
		*/
		function tokenize() {

			// 8.1. Descriptor tokeniser: Skip whitespace
			collectCharacters(regexLeadingSpaces);

			// 8.2. Let current descriptor be the empty string.
			currentDescriptor = "";

			// 8.3. Let state be in descriptor.
			state = "in descriptor";

			while (true) {

				// 8.4. Let c be the character at position.
				c = input.charAt(pos);

				//  Do the following depending on the value of state.
				//  For the purpose of this step, "EOF" is a special character representing
				//  that position is past the end of input.

				// In descriptor
				if (state === "in descriptor") {
					// Do the following, depending on the value of c:

				  // Space character
				  // If current descriptor is not empty, append current descriptor to
				  // descriptors and let current descriptor be the empty string.
				  // Set state to after descriptor.
					if (isSpace(c)) {
						if (currentDescriptor) {
							descriptors.push(currentDescriptor);
							currentDescriptor = "";
							state = "after descriptor";
						}

					// U+002C COMMA (,)
					// Advance position to the next character in input. If current descriptor
					// is not empty, append current descriptor to descriptors. Jump to the step
					// labeled descriptor parser.
					} else if (c === ",") {
						pos += 1;
						if (currentDescriptor) {
							descriptors.push(currentDescriptor);
						}
						parseDescriptors();
						return;

					// U+0028 LEFT PARENTHESIS (()
					// Append c to current descriptor. Set state to in parens.
					} else if (c === "\u0028") {
						currentDescriptor = currentDescriptor + c;
						state = "in parens";

					// EOF
					// If current descriptor is not empty, append current descriptor to
					// descriptors. Jump to the step labeled descriptor parser.
					} else if (c === "") {
						if (currentDescriptor) {
							descriptors.push(currentDescriptor);
						}
						parseDescriptors();
						return;

					// Anything else
					// Append c to current descriptor.
					} else {
						currentDescriptor = currentDescriptor + c;
					}
				// (end "in descriptor"

				// In parens
				} else if (state === "in parens") {

					// U+0029 RIGHT PARENTHESIS ())
					// Append c to current descriptor. Set state to in descriptor.
					if (c === ")") {
						currentDescriptor = currentDescriptor + c;
						state = "in descriptor";

					// EOF
					// Append current descriptor to descriptors. Jump to the step labeled
					// descriptor parser.
					} else if (c === "") {
						descriptors.push(currentDescriptor);
						parseDescriptors();
						return;

					// Anything else
					// Append c to current descriptor.
					} else {
						currentDescriptor = currentDescriptor + c;
					}

				// After descriptor
				} else if (state === "after descriptor") {

					// Do the following, depending on the value of c:
					// Space character: Stay in this state.
					if (isSpace(c)) {

					// EOF: Jump to the step labeled descriptor parser.
					} else if (c === "") {
						parseDescriptors();
						return;

					// Anything else
					// Set state to in descriptor. Set position to the previous character in input.
					} else {
						state = "in descriptor";
						pos -= 1;

					}
				}

				// Advance position to the next character in input.
				pos += 1;

			// Repeat this step.
			} // (close while true loop)
		}

		// 4. Splitting loop: Collect a sequence of characters that are space
		//    characters or U+002C COMMA characters. If any U+002C COMMA characters
		//    were collected, that is a parse error.
		while (true) {
			collectCharacters(regexLeadingCommasOrSpaces);

			// 5. If position is past the end of input, return candidates and abort these steps.
			if (pos >= inputLength) {
				return candidates; // (we're done, this is the sole return path)
			}

			// 6. Collect a sequence of characters that are not space characters,
			//    and let that be url.
			url = collectCharacters(regexLeadingNotSpaces);

			// 7. Let descriptors be a new empty list.
			descriptors = [];

			// 8. If url ends with a U+002C COMMA character (,), follow these substeps:
			//		(1). Remove all trailing U+002C COMMA characters from url. If this removed
			//         more than one character, that is a parse error.
			if (url.slice(-1) === ",") {
				url = url.replace(regexTrailingCommas, "");
				// (Jump ahead to step 9 to skip tokenization and just push the candidate).
				parseDescriptors();

			//	Otherwise, follow these substeps:
			} else {
				tokenize();
			} // (close else of step 8)

		// 16. Return to the step labeled splitting loop.
		} // (Close of big while loop.)
	}

	/*
	 * Sizes Parser
	 *
	 * By Alex Bell |  MIT License
	 *
	 * Non-strict but accurate and lightweight JS Parser for the string value <img sizes="here">
	 *
	 * Reference algorithm at:
	 * https://html.spec.whatwg.org/multipage/embedded-content.html#parse-a-sizes-attribute
	 *
	 * Most comments are copied in directly from the spec
	 * (except for comments in parens).
	 *
	 * Grammar is:
	 * <source-size-list> = <source-size># [ , <source-size-value> ]? | <source-size-value>
	 * <source-size> = <media-condition> <source-size-value>
	 * <source-size-value> = <length>
	 * http://www.w3.org/html/wg/drafts/html/master/embedded-content.html#attr-img-sizes
	 *
	 * E.g. "(max-width: 30em) 100vw, (max-width: 50em) 70vw, 100vw"
	 * or "(min-width: 30em), calc(30vw - 15px)" or just "30vw"
	 *
	 * Returns the first valid <css-length> with a media condition that evaluates to true,
	 * or "100vw" if all valid media conditions evaluate to false.
	 *
	 */

	function parseSizes(strValue) {

		// (Percentage CSS lengths are not allowed in this case, to avoid confusion:
		// https://html.spec.whatwg.org/multipage/embedded-content.html#valid-source-size-list
		// CSS allows a single optional plus or minus sign:
		// http://www.w3.org/TR/CSS2/syndata.html#numbers
		// CSS is ASCII case-insensitive:
		// http://www.w3.org/TR/CSS2/syndata.html#characters )
		// Spec allows exponential notation for <number> type:
		// http://dev.w3.org/csswg/css-values/#numbers
		var regexCssLengthWithUnits = /^(?:[+-]?[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?(?:ch|cm|em|ex|in|mm|pc|pt|px|rem|vh|vmin|vmax|vw)$/i;

		// (This is a quick and lenient test. Because of optional unlimited-depth internal
		// grouping parens and strict spacing rules, this could get very complicated.)
		var regexCssCalc = /^calc\((?:[0-9a-z \.\+\-\*\/\(\)]+)\)$/i;

		var i;
		var unparsedSizesList;
		var unparsedSizesListLength;
		var unparsedSize;
		var lastComponentValue;
		var size;

		// UTILITY FUNCTIONS

		//  (Toy CSS parser. The goals here are:
		//  1) expansive test coverage without the weight of a full CSS parser.
		//  2) Avoiding regex wherever convenient.
		//  Quick tests: http://jsfiddle.net/gtntL4gr/3/
		//  Returns an array of arrays.)
		function parseComponentValues(str) {
			var chrctr;
			var component = "";
			var componentArray = [];
			var listArray = [];
			var parenDepth = 0;
			var pos = 0;
			var inComment = false;

			function pushComponent() {
				if (component) {
					componentArray.push(component);
					component = "";
				}
			}

			function pushComponentArray() {
				if (componentArray[0]) {
					listArray.push(componentArray);
					componentArray = [];
				}
			}

			// (Loop forwards from the beginning of the string.)
			while (true) {
				chrctr = str.charAt(pos);

				if (chrctr === "") { // ( End of string reached.)
					pushComponent();
					pushComponentArray();
					return listArray;
				} else if (inComment) {
					if ((chrctr === "*") && (str[pos + 1] === "/")) { // (At end of a comment.)
						inComment = false;
						pos += 2;
						pushComponent();
						continue;
					} else {
						pos += 1; // (Skip all characters inside comments.)
						continue;
					}
				} else if (isSpace(chrctr)) {
					// (If previous character in loop was also a space, or if
					// at the beginning of the string, do not add space char to
					// component.)
					if ( (str.charAt(pos - 1) && isSpace( str.charAt(pos - 1) ) ) || !component ) {
						pos += 1;
						continue;
					} else if (parenDepth === 0) {
						pushComponent();
						pos +=1;
						continue;
					} else {
						// (Replace any space character with a plain space for legibility.)
						chrctr = " ";
					}
				} else if (chrctr === "(") {
					parenDepth += 1;
				} else if (chrctr === ")") {
					parenDepth -= 1;
				} else if (chrctr === ",") {
					pushComponent();
					pushComponentArray();
					pos += 1;
					continue;
				} else if ( (chrctr === "/") && (str.charAt(pos + 1) === "*") ) {
					inComment = true;
					pos += 2;
					continue;
				}

				component = component + chrctr;
				pos += 1;
			}
		}

		function isValidNonNegativeSourceSizeValue(s) {
			if (regexCssLengthWithUnits.test(s) && (parseFloat(s) >= 0)) {return true;}
			if (regexCssCalc.test(s)) {return true;}
			// ( http://www.w3.org/TR/CSS2/syndata.html#numbers says:
			// "-0 is equivalent to 0 and is not a negative number." which means that
			// unitless zero and unitless negative zero must be accepted as special cases.)
			if ((s === "0") || (s === "-0") || (s === "+0")) {return true;}
			return false;
		}

		// When asked to parse a sizes attribute from an element, parse a
		// comma-separated list of component values from the value of the element's
		// sizes attribute (or the empty string, if the attribute is absent), and let
		// unparsed sizes list be the result.
		// http://dev.w3.org/csswg/css-syntax/#parse-comma-separated-list-of-component-values

		unparsedSizesList = parseComponentValues(strValue);
		unparsedSizesListLength = unparsedSizesList.length;

		// For each unparsed size in unparsed sizes list:
		for (i = 0; i < unparsedSizesListLength; i++) {
			unparsedSize = unparsedSizesList[i];

			// 1. Remove all consecutive <whitespace-token>s from the end of unparsed size.
			// ( parseComponentValues() already omits spaces outside of parens. )

			// If unparsed size is now empty, that is a parse error; continue to the next
			// iteration of this algorithm.
			// ( parseComponentValues() won't push an empty array. )

			// 2. If the last component value in unparsed size is a valid non-negative
			// <source-size-value>, let size be its value and remove the component value
			// from unparsed size. Any CSS function other than the calc() function is
			// invalid. Otherwise, there is a parse error; continue to the next iteration
			// of this algorithm.
			// http://dev.w3.org/csswg/css-syntax/#parse-component-value
			lastComponentValue = unparsedSize[unparsedSize.length - 1];

			if (isValidNonNegativeSourceSizeValue(lastComponentValue)) {
				size = lastComponentValue;
				unparsedSize.pop();
			} else {
				continue;
			}

			// 3. Remove all consecutive <whitespace-token>s from the end of unparsed
			// size. If unparsed size is now empty, return size and exit this algorithm.
			// If this was not the last item in unparsed sizes list, that is a parse error.
			if (unparsedSize.length === 0) {
				return size;
			}

			// 4. Parse the remaining component values in unparsed size as a
			// <media-condition>. If it does not parse correctly, or it does parse
			// correctly but the <media-condition> evaluates to false, continue to the
			// next iteration of this algorithm.
			// (Parsing all possible compound media conditions in JS is heavy, complicated,
			// and the payoff is unclear. Is there ever an situation where the
			// media condition parses incorrectly but still somehow evaluates to true?
			// Can we just rely on the browser/polyfill to do it?)
			unparsedSize = unparsedSize.join(" ");
			if (!(pf.matchesMedia( unparsedSize ) ) ) {
				continue;
			}

			// 5. Return size and exit this algorithm.
			return size;
		}

		// If the above algorithm exhausts unparsed sizes list without returning a
		// size value, return 100vw.
		return "100vw";
	}

	// namespace
	pf.ns = ("pf" + new Date().getTime()).substr(0, 9);

	// srcset support test
	pf.supSrcset = "srcset" in image;
	pf.supSizes = "sizes" in image;
	pf.supPicture = !!window.HTMLPictureElement;

	// UC browser does claim to support srcset and picture, but not sizes,
	// this extended test reveals the browser does support nothing
	if (pf.supSrcset && pf.supPicture && !pf.supSizes) {
		(function(image2) {
			image.srcset = "data:,a";
			image2.src = "data:,a";
			pf.supSrcset = image.complete === image2.complete;
			pf.supPicture = pf.supSrcset && pf.supPicture;
		})(document.createElement("img"));
	}

	// Safari9 has basic support for sizes, but does't expose the `sizes` idl attribute
	if (pf.supSrcset && !pf.supSizes) {

		(function() {
			var width2 = "data:image/gif;base64,R0lGODlhAgABAPAAAP///wAAACH5BAAAAAAALAAAAAACAAEAAAICBAoAOw==";
			var width1 = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
			var img = document.createElement("img");
			var test = function() {
				var width = img.width;

				if (width === 2) {
					pf.supSizes = true;
				}

				alwaysCheckWDescriptor = pf.supSrcset && !pf.supSizes;

				isSupportTestReady = true;
				// force async
				setTimeout(picturefill);
			};

			img.onload = test;
			img.onerror = test;
			img.setAttribute("sizes", "9px");

			img.srcset = width1 + " 1w," + width2 + " 9w";
			img.src = width1;
		})();

	} else {
		isSupportTestReady = true;
	}

	// using pf.qsa instead of dom traversing does scale much better,
	// especially on sites mixing responsive and non-responsive images
	pf.selShort = "picture>img,img[srcset]";
	pf.sel = pf.selShort;
	pf.cfg = cfg;

	/**
	 * Shortcut property for `devicePixelRatio` ( for easy overriding in tests )
	 */
	pf.DPR = (DPR  || 1 );
	pf.u = units;

	// container of supported mime types that one might need to qualify before using
	pf.types =  types;

	pf.setSize = noop;

	/**
	 * Gets a string and returns the absolute URL
	 * @param src
	 * @returns {String} absolute URL
	 */

	pf.makeUrl = memoize(function(src) {
		anchor.href = src;
		return anchor.href;
	});

	/**
	 * Gets a DOM element or document and a selctor and returns the found matches
	 * Can be extended with jQuery/Sizzle for IE7 support
	 * @param context
	 * @param sel
	 * @returns {NodeList|Array}
	 */
	pf.qsa = function(context, sel) {
		return ( "querySelector" in context ) ? context.querySelectorAll(sel) : [];
	};

	/**
	 * Shortcut method for matchMedia ( for easy overriding in tests )
	 * wether native or pf.mMQ is used will be decided lazy on first call
	 * @returns {boolean}
	 */
	pf.matchesMedia = function() {
		if ( window.matchMedia && (matchMedia( "(min-width: 0.1em)" ) || {}).matches ) {
			pf.matchesMedia = function( media ) {
				return !media || ( matchMedia( media ).matches );
			};
		} else {
			pf.matchesMedia = pf.mMQ;
		}

		return pf.matchesMedia.apply( this, arguments );
	};

	/**
	 * A simplified matchMedia implementation for IE8 and IE9
	 * handles only min-width/max-width with px or em values
	 * @param media
	 * @returns {boolean}
	 */
	pf.mMQ = function( media ) {
		return media ? evalCSS(media) : true;
	};

	/**
	 * Returns the calculated length in css pixel from the given sourceSizeValue
	 * http://dev.w3.org/csswg/css-values-3/#length-value
	 * intended Spec mismatches:
	 * * Does not check for invalid use of CSS functions
	 * * Does handle a computed length of 0 the same as a negative and therefore invalid value
	 * @param sourceSizeValue
	 * @returns {Number}
	 */
	pf.calcLength = function( sourceSizeValue ) {

		var value = evalCSS(sourceSizeValue, true) || false;
		if (value < 0) {
			value = false;
		}

		return value;
	};

	/**
	 * Takes a type string and checks if its supported
	 */

	pf.supportsType = function( type ) {
		return ( type ) ? types[ type ] : true;
	};

	/**
	 * Parses a sourceSize into mediaCondition (media) and sourceSizeValue (length)
	 * @param sourceSizeStr
	 * @returns {*}
	 */
	pf.parseSize = memoize(function( sourceSizeStr ) {
		var match = ( sourceSizeStr || "" ).match(regSize);
		return {
			media: match && match[1],
			length: match && match[2]
		};
	});

	pf.parseSet = function( set ) {
		if ( !set.cands ) {
			set.cands = parseSrcset(set.srcset, set);
		}
		return set.cands;
	};

	/**
	 * returns 1em in css px for html/body default size
	 * function taken from respondjs
	 * @returns {*|number}
	 */
	pf.getEmValue = function() {
		var body;
		if ( !eminpx && (body = document.body) ) {
			var div = document.createElement( "div" ),
				originalHTMLCSS = docElem.style.cssText,
				originalBodyCSS = body.style.cssText;

			div.style.cssText = baseStyle;

			// 1em in a media query is the value of the default font size of the browser
			// reset docElem and body to ensure the correct value is returned
			docElem.style.cssText = fsCss;
			body.style.cssText = fsCss;

			body.appendChild( div );
			eminpx = div.offsetWidth;
			body.removeChild( div );

			//also update eminpx before returning
			eminpx = parseFloat( eminpx, 10 );

			// restore the original values
			docElem.style.cssText = originalHTMLCSS;
			body.style.cssText = originalBodyCSS;

		}
		return eminpx || 16;
	};

	/**
	 * Takes a string of sizes and returns the width in pixels as a number
	 */
	pf.calcListLength = function( sourceSizeListStr ) {
		// Split up source size list, ie ( max-width: 30em ) 100%, ( max-width: 50em ) 50%, 33%
		//
		//                           or (min-width:30em) calc(30% - 15px)
		if ( !(sourceSizeListStr in sizeLengthCache) || cfg.uT ) {
			var winningLength = pf.calcLength( parseSizes( sourceSizeListStr ) );

			sizeLengthCache[ sourceSizeListStr ] = !winningLength ? units.width : winningLength;
		}

		return sizeLengthCache[ sourceSizeListStr ];
	};

	/**
	 * Takes a candidate object with a srcset property in the form of url/
	 * ex. "images/pic-medium.png 1x, images/pic-medium-2x.png 2x" or
	 *     "images/pic-medium.png 400w, images/pic-medium-2x.png 800w" or
	 *     "images/pic-small.png"
	 * Get an array of image candidates in the form of
	 *      {url: "/foo/bar.png", resolution: 1}
	 * where resolution is http://dev.w3.org/csswg/css-values-3/#resolution-value
	 * If sizes is specified, res is calculated
	 */
	pf.setRes = function( set ) {
		var candidates;
		if ( set ) {

			candidates = pf.parseSet( set );

			for ( var i = 0, len = candidates.length; i < len; i++ ) {
				setResolution( candidates[ i ], set.sizes );
			}
		}
		return candidates;
	};

	pf.setRes.res = setResolution;

	pf.applySetCandidate = function( candidates, img ) {
		if ( !candidates.length ) {return;}
		var candidate,
			i,
			j,
			length,
			bestCandidate,
			curSrc,
			curCan,
			candidateSrc,
			abortCurSrc;

		var imageData = img[ pf.ns ];
		var dpr = pf.DPR;

		curSrc = imageData.curSrc || img[curSrcProp];

		curCan = imageData.curCan || setSrcToCur(img, curSrc, candidates[0].set);

		// if we have a current source, we might either become lazy or give this source some advantage
		if ( curCan && curCan.set === candidates[ 0 ].set ) {

			// if browser can abort image request and the image has a higher pixel density than needed
			// and this image isn't downloaded yet, we skip next part and try to save bandwidth
			abortCurSrc = (supportAbort && !img.complete && curCan.res - 0.1 > dpr);

			if ( !abortCurSrc ) {
				curCan.cached = true;

				// if current candidate is "best", "better" or "okay",
				// set it to bestCandidate
				if ( curCan.res >= dpr ) {
					bestCandidate = curCan;
				}
			}
		}

		if ( !bestCandidate ) {

			candidates.sort( ascendingSort );

			length = candidates.length;
			bestCandidate = candidates[ length - 1 ];

			for ( i = 0; i < length; i++ ) {
				candidate = candidates[ i ];
				if ( candidate.res >= dpr ) {
					j = i - 1;

					// we have found the perfect candidate,
					// but let's improve this a little bit with some assumptions ;-)
					if (candidates[ j ] &&
						(abortCurSrc || curSrc !== pf.makeUrl( candidate.url )) &&
						chooseLowRes(candidates[ j ].res, candidate.res, dpr, candidates[ j ].cached)) {

						bestCandidate = candidates[ j ];

					} else {
						bestCandidate = candidate;
					}
					break;
				}
			}
		}

		if ( bestCandidate ) {

			candidateSrc = pf.makeUrl( bestCandidate.url );

			imageData.curSrc = candidateSrc;
			imageData.curCan = bestCandidate;

			if ( candidateSrc !== curSrc ) {
				pf.setSrc( img, bestCandidate );
			}
			pf.setSize( img );
		}
	};

	pf.setSrc = function( img, bestCandidate ) {
		var origWidth;
		img.src = bestCandidate.url;

		// although this is a specific Safari issue, we don't want to take too much different code paths
		if ( bestCandidate.set.type === "image/svg+xml" ) {
			origWidth = img.style.width;
			img.style.width = (img.offsetWidth + 1) + "px";

			// next line only should trigger a repaint
			// if... is only done to trick dead code removal
			if ( img.offsetWidth + 1 ) {
				img.style.width = origWidth;
			}
		}
	};

	pf.getSet = function( img ) {
		var i, set, supportsType;
		var match = false;
		var sets = img [ pf.ns ].sets;

		for ( i = 0; i < sets.length && !match; i++ ) {
			set = sets[i];

			if ( !set.srcset || !pf.matchesMedia( set.media ) || !(supportsType = pf.supportsType( set.type )) ) {
				continue;
			}

			if ( supportsType === "pending" ) {
				set = supportsType;
			}

			match = set;
			break;
		}

		return match;
	};

	pf.parseSets = function( element, parent, options ) {
		var srcsetAttribute, imageSet, isWDescripor, srcsetParsed;

		var hasPicture = parent && parent.nodeName.toUpperCase() === "PICTURE";
		var imageData = element[ pf.ns ];

		if ( imageData.src === undefined || options.src ) {
			imageData.src = getImgAttr.call( element, "src" );
			if ( imageData.src ) {
				setImgAttr.call( element, srcAttr, imageData.src );
			} else {
				removeImgAttr.call( element, srcAttr );
			}
		}

		if ( imageData.srcset === undefined || options.srcset || !pf.supSrcset || element.srcset ) {
			srcsetAttribute = getImgAttr.call( element, "srcset" );
			imageData.srcset = srcsetAttribute;
			srcsetParsed = true;
		}

		imageData.sets = [];

		if ( hasPicture ) {
			imageData.pic = true;
			getAllSourceElements( parent, imageData.sets );
		}

		if ( imageData.srcset ) {
			imageSet = {
				srcset: imageData.srcset,
				sizes: getImgAttr.call( element, "sizes" )
			};

			imageData.sets.push( imageSet );

			isWDescripor = (alwaysCheckWDescriptor || imageData.src) && regWDesc.test(imageData.srcset || "");

			// add normal src as candidate, if source has no w descriptor
			if ( !isWDescripor && imageData.src && !getCandidateForSrc(imageData.src, imageSet) && !imageSet.has1x ) {
				imageSet.srcset += ", " + imageData.src;
				imageSet.cands.push({
					url: imageData.src,
					d: 1,
					set: imageSet
				});
			}

		} else if ( imageData.src ) {
			imageData.sets.push( {
				srcset: imageData.src,
				sizes: null
			} );
		}

		imageData.curCan = null;
		imageData.curSrc = undefined;

		// if img has picture or the srcset was removed or has a srcset and does not support srcset at all
		// or has a w descriptor (and does not support sizes) set support to false to evaluate
		imageData.supported = !( hasPicture || ( imageSet && !pf.supSrcset ) || (isWDescripor && !pf.supSizes) );

		if ( srcsetParsed && pf.supSrcset && !imageData.supported ) {
			if ( srcsetAttribute ) {
				setImgAttr.call( element, srcsetAttr, srcsetAttribute );
				element.srcset = "";
			} else {
				removeImgAttr.call( element, srcsetAttr );
			}
		}

		if (imageData.supported && !imageData.srcset && ((!imageData.src && element.src) ||  element.src !== pf.makeUrl(imageData.src))) {
			if (imageData.src === null) {
				element.removeAttribute("src");
			} else {
				element.src = imageData.src;
			}
		}

		imageData.parsed = true;
	};

	pf.fillImg = function(element, options) {
		var imageData;
		var extreme = options.reselect || options.reevaluate;

		// expando for caching data on the img
		if ( !element[ pf.ns ] ) {
			element[ pf.ns ] = {};
		}

		imageData = element[ pf.ns ];

		// if the element has already been evaluated, skip it
		// unless `options.reevaluate` is set to true ( this, for example,
		// is set to true when running `picturefill` on `resize` ).
		if ( !extreme && imageData.evaled === evalId ) {
			return;
		}

		if ( !imageData.parsed || options.reevaluate ) {
			pf.parseSets( element, element.parentNode, options );
		}

		if ( !imageData.supported ) {
			applyBestCandidate( element );
		} else {
			imageData.evaled = evalId;
		}
	};

	pf.setupRun = function() {
		if ( !alreadyRun || isVwDirty || (DPR !== window.devicePixelRatio) ) {
			updateMetrics();
		}
	};

	// If picture is supported, well, that's awesome.
	if ( pf.supPicture ) {
		picturefill = noop;
		pf.fillImg = noop;
	} else {

		 // Set up picture polyfill by polling the document
		(function() {
			var isDomReady;
			var regReady = window.attachEvent ? /d$|^c/ : /d$|^c|^i/;

			var run = function() {
				var readyState = document.readyState || "";

				timerId = setTimeout(run, readyState === "loading" ? 200 :  999);
				if ( document.body ) {
					pf.fillImgs();
					isDomReady = isDomReady || regReady.test(readyState);
					if ( isDomReady ) {
						clearTimeout( timerId );
					}

				}
			};

			var timerId = setTimeout(run, document.body ? 9 : 99);

			// Also attach picturefill on resize and readystatechange
			// http://modernjavascript.blogspot.com/2013/08/building-better-debounce.html
			var debounce = function(func, wait) {
				var timeout, timestamp;
				var later = function() {
					var last = (new Date()) - timestamp;

					if (last < wait) {
						timeout = setTimeout(later, wait - last);
					} else {
						timeout = null;
						func();
					}
				};

				return function() {
					timestamp = new Date();

					if (!timeout) {
						timeout = setTimeout(later, wait);
					}
				};
			};
			var lastClientWidth = docElem.clientHeight;
			var onResize = function() {
				isVwDirty = Math.max(window.innerWidth || 0, docElem.clientWidth) !== units.width || docElem.clientHeight !== lastClientWidth;
				lastClientWidth = docElem.clientHeight;
				if ( isVwDirty ) {
					pf.fillImgs();
				}
			};

			on( window, "resize", debounce(onResize, 99 ) );
			on( document, "readystatechange", run );
		})();
	}

	pf.picturefill = picturefill;
	//use this internally for easy monkey patching/performance testing
	pf.fillImgs = picturefill;
	pf.teardownRun = noop;

	/* expose methods for testing */
	picturefill._ = pf;

	window.picturefillCFG = {
		pf: pf,
		push: function(args) {
			var name = args.shift();
			if (typeof pf[name] === "function") {
				pf[name].apply(pf, args);
			} else {
				cfg[name] = args[0];
				if (alreadyRun) {
					pf.fillImgs( { reselect: true } );
				}
			}
		}
	};

	while (setOptions && setOptions.length) {
		window.picturefillCFG.push(setOptions.shift());
	}

	/* expose picturefill */
	window.picturefill = picturefill;

	/* expose picturefill */
	if ( typeof module === "object" && typeof module.exports === "object" ) {
		// CommonJS, just export
		module.exports = picturefill;
	} else if ( typeof define === "function" && define.amd ) {
		// AMD support
		define( "picturefill", function() { return picturefill; } );
	}

	// IE8 evals this sync, so it must be the last thing we do
	if ( !pf.supPicture ) {
		types[ "image/webp" ] = detectTypeSupport("image/webp", "data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==" );
	}

} )( window, document );


/////////fullpage

/*!
 * fullPage 3.0.8
 * https://github.com/alvarotrigo/fullPage.js
 *
 * @license GPLv3 for open source use only
 * or Fullpage Commercial License for commercial use
 * http://alvarotrigo.com/fullPage/pricing/
 *
 * Copyright (C) 2018 http://alvarotrigo.com/fullPage - A project by Alvaro Trigo
 */
(function( root, window, document, factory, undefined) {
  if( typeof define === 'function' && define.amd ) {
      // AMD. Register as an anonymous module.
      define( function() {
          root.fullpage = factory(window, document);
          return root.fullpage;
      } );
  } else if( typeof exports === 'object' ) {
      // Node. Does not work with strict CommonJS.
      module.exports = factory(window, document);
  } else {
      // Browser globals.
      window.fullpage = factory(window, document);
  }
}(this, window, document, function(window, document){
  'use strict';

  // keeping central set of classnames and selectors
  var WRAPPER =               'fullpage-wrapper';
  var WRAPPER_SEL =           '.' + WRAPPER;

  // slimscroll
  var SCROLLABLE =            'fp-scrollable';
  var SCROLLABLE_SEL =        '.' + SCROLLABLE;

  // util
  var RESPONSIVE =            'fp-responsive';
  var NO_TRANSITION =         'fp-notransition';
  var DESTROYED =             'fp-destroyed';
  var ENABLED =               'fp-enabled';
  var VIEWING_PREFIX =        'fp-viewing';
  var ACTIVE =                'active';
  var ACTIVE_SEL =            '.' + ACTIVE;
  var COMPLETELY =            'fp-completely';
  var COMPLETELY_SEL =        '.' + COMPLETELY;

  // section
  var SECTION_DEFAULT_SEL =   '.section';
  var SECTION =               'fp-section';
  var SECTION_SEL =           '.' + SECTION;
  var SECTION_ACTIVE_SEL =    SECTION_SEL + ACTIVE_SEL;
  var TABLE_CELL =            'fp-tableCell';
  var TABLE_CELL_SEL =        '.' + TABLE_CELL;
  var AUTO_HEIGHT =           'fp-auto-height';
  var AUTO_HEIGHT_SEL =       '.' + AUTO_HEIGHT;
  var AUTO_HEIGHT_RESPONSIVE = 'fp-auto-height-responsive';
  var AUTO_HEIGHT_RESPONSIVE_SEL = '.' + AUTO_HEIGHT_RESPONSIVE;
  var NORMAL_SCROLL =         'fp-normal-scroll';
  var NORMAL_SCROLL_SEL =     '.' + NORMAL_SCROLL;

  // section nav
  var SECTION_NAV =           'fp-nav';
  var SECTION_NAV_SEL =       '#' + SECTION_NAV;
  var SECTION_NAV_TOOLTIP =   'fp-tooltip';
  var SECTION_NAV_TOOLTIP_SEL='.'+SECTION_NAV_TOOLTIP;
  var SHOW_ACTIVE_TOOLTIP =   'fp-show-active';

  // slide
  var SLIDE_DEFAULT_SEL =     '.slide';
  var SLIDE =                 'fp-slide';
  var SLIDE_SEL =             '.' + SLIDE;
  var SLIDE_ACTIVE_SEL =      SLIDE_SEL + ACTIVE_SEL;
  var SLIDES_WRAPPER =        'fp-slides';
  var SLIDES_WRAPPER_SEL =    '.' + SLIDES_WRAPPER;
  var SLIDES_CONTAINER =      'fp-slidesContainer';
  var SLIDES_CONTAINER_SEL =  '.' + SLIDES_CONTAINER;
  var TABLE =                 'fp-table';

  // slide nav
  var SLIDES_NAV =            'fp-slidesNav';
  var SLIDES_NAV_SEL =        '.' + SLIDES_NAV;
  var SLIDES_NAV_LINK_SEL =   SLIDES_NAV_SEL + ' a';
  var SLIDES_ARROW =          'fp-controlArrow';
  var SLIDES_ARROW_SEL =      '.' + SLIDES_ARROW;
  var SLIDES_PREV =           'fp-prev';
  var SLIDES_PREV_SEL =       '.' + SLIDES_PREV;
  var SLIDES_ARROW_PREV =     SLIDES_ARROW + ' ' + SLIDES_PREV;
  var SLIDES_ARROW_PREV_SEL = SLIDES_ARROW_SEL + SLIDES_PREV_SEL;
  var SLIDES_NEXT =           'fp-next';
  var SLIDES_NEXT_SEL =       '.' + SLIDES_NEXT;
  var SLIDES_ARROW_NEXT =     SLIDES_ARROW + ' ' + SLIDES_NEXT;
  var SLIDES_ARROW_NEXT_SEL = SLIDES_ARROW_SEL + SLIDES_NEXT_SEL;

  function initialise(containerSelector, options) {
      var isOK = options && new RegExp('([\\d\\w]{8}-){3}[\\d\\w]{8}|^(?=.*?[A-Y])(?=.*?[a-y])(?=.*?[0-8])(?=.*?[#?!@$%^&*-]).{8,}$').test(options['li'+'cen'+'seK' + 'e' + 'y']) || document.domain.indexOf('al'+'varotri' +'go' + '.' + 'com') > -1;

      // cache common elements
      var $htmlBody = $('html, body');
      var $html = $('html')[0];
      var $body = $('body')[0];

      //only once my friend!
      if(hasClass($html, ENABLED)){ displayWarnings(); return; }

      var FP = {};

      // Creating some defaults, extending them with any options that were provided
      options = deepExtend({
          //navigation
          menu: false,
          anchors:[],
          lockAnchors: false,
          navigation: false,
          navigationPosition: 'right',
          navigationTooltips: [],
          showActiveTooltip: false,
          slidesNavigation: false,
          slidesNavPosition: 'bottom',
          scrollBar: false,
          hybrid: false,

          //scrolling
          css3: true,
          scrollingSpeed: 700,
          autoScrolling: true,
          fitToSection: true,
          fitToSectionDelay: 1000,
          easing: 'easeInOutCubic',
          easingcss3: 'ease',
          loopBottom: false,
          loopTop: false,
          loopHorizontal: true,
          continuousVertical: false,
          continuousHorizontal: false,
          scrollHorizontally: false,
          interlockedSlides: false,
          dragAndMove: false,
          offsetSections: false,
          resetSliders: false,
          fadingEffect: false,
          normalScrollElements: null,
          scrollOverflow: false,
          scrollOverflowReset: false,
          scrollOverflowHandler: window.fp_scrolloverflow ? window.fp_scrolloverflow.iscrollHandler : null,
          scrollOverflowOptions: null,
          touchSensitivity: 5,
          touchWrapper: typeof containerSelector === 'string' ? $(containerSelector)[0] : containerSelector,
          bigSectionsDestination: null,

          //Accessibility
          keyboardScrolling: true,
          animateAnchor: true,
          recordHistory: true,

          //design
          controlArrows: true,
          controlArrowColor: '#fff',
          verticalCentered: true,
          sectionsColor : [],
          paddingTop: 0,
          paddingBottom: 0,
          fixedElements: null,
          responsive: 0, //backwards compabitility with responsiveWiddth
          responsiveWidth: 0,
          responsiveHeight: 0,
          responsiveSlides: false,
          parallax: false,
          parallaxOptions: {
              type: 'reveal',
              percentage: 62,
              property: 'translate'
          },
          cards: false,
          cardsOptions: {
              perspective: 100,
              fadeContent: true,
              fadeBackground: true
          },

          //Custom selectors
          sectionSelector: SECTION_DEFAULT_SEL,
          slideSelector: SLIDE_DEFAULT_SEL,

          //events
          v2compatible: false,
          afterLoad: null,
          onLeave: null,
          afterRender: null,
          afterResize: null,
          afterReBuild: null,
          afterSlideLoad: null,
          onSlideLeave: null,
          afterResponsive: null,

          lazyLoading: true
      }, options);

      //flag to avoid very fast sliding for landscape sliders
      var slideMoving = false;

      var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/);
      var isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));
      var container = typeof containerSelector === 'string' ? $(containerSelector)[0] : containerSelector;
      var windowsHeight = getWindowHeight();
      var windowsWidth = getWindowWidth();
      var isResizing = false;
      var isWindowFocused = true;
      var lastScrolledDestiny;
      var lastScrolledSlide;
      var canScroll = true;
      var scrollings = [];
      var controlPressed;
      var startingSection;
      var isScrollAllowed = {};
      isScrollAllowed.m = {  'up':true, 'down':true, 'left':true, 'right':true };
      isScrollAllowed.k = deepExtend({}, isScrollAllowed.m);
      var MSPointer = getMSPointer();
      var events = {
          touchmove: 'ontouchmove' in window ? 'touchmove' :  MSPointer.move,
          touchstart: 'ontouchstart' in window ? 'touchstart' :  MSPointer.down
      };
      var scrollBarHandler;

      // taken from https://github.com/udacity/ud891/blob/gh-pages/lesson2-focus/07-modals-and-keyboard-traps/solution/modal.js
      var focusableElementsString = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';

      //cheks for passive event support
      var g_supportsPassive = false;
      try {
        var opts = Object.defineProperty({}, 'passive', {
          get: function() {
            g_supportsPassive = true;
          }
        });
        window.addEventListener("testPassive", null, opts);
        window.removeEventListener("testPassive", null, opts);
      } catch (e) {}

      //timeouts
      var resizeId;
      var resizeHandlerId;
      var afterSectionLoadsId;
      var afterSlideLoadsId;
      var scrollId;
      var scrollId2;
      var keydownId;
      var g_doubleCheckHeightId;
      var originals = deepExtend({}, options); //deep copy
      var activeAnimation;
      var g_initialAnchorsInDom = false;
      var g_canFireMouseEnterNormalScroll = true;
      var g_mediaLoadedId;
      var extensions = [
          'parallax',
          'scrollOverflowReset',
          'dragAndMove',
          'offsetSections',
          'fadingEffect',
          'responsiveSlides',
          'continuousHorizontal',
          'interlockedSlides',
          'scrollHorizontally',
          'resetSliders',
          'cards'
      ];

      displayWarnings();

      //easeInOutCubic animation included in the plugin
      window.fp_easings = deepExtend(window.fp_easings, {
          easeInOutCubic: function (t, b, c, d) {
              if ((t/=d/2) < 1) return c/2*t*t*t + b;return c/2*((t-=2)*t*t + 2) + b;
          }
      });

      /**
      * Sets the autoScroll option.
      * It changes the scroll bar visibility and the history of the site as a result.
      */
      function setAutoScrolling(value, type){
          //removing the transformation
          if(!value){
              silentScroll(0);
          }

          setVariableState('autoScrolling', value, type);

          var element = $(SECTION_ACTIVE_SEL)[0];

          if(options.autoScrolling && !options.scrollBar){
              css($htmlBody, {
                  'overflow': 'hidden',
                  'height': '100%'
              });

              setRecordHistory(originals.recordHistory, 'internal');

              //for IE touch devices
              css(container, {
                  '-ms-touch-action': 'none',
                  'touch-action': 'none'
              });

              if(element != null){
                  //moving the container up
                  silentScroll(element.offsetTop);
              }
          }else{
              css($htmlBody, {
                  'overflow' : 'visible',
                  'height' : 'initial'
              });

              var recordHistory = !options.autoScrolling ? false : originals.recordHistory;
              setRecordHistory(recordHistory, 'internal');

              //for IE touch devices
              css(container, {
                  '-ms-touch-action': '',
                  'touch-action': ''
              });

              //scrolling the page to the section with no animation
              if (element != null) {
                  var scrollSettings = getScrollSettings(element.offsetTop);
                  scrollSettings.element.scrollTo(0, scrollSettings.options);
              }
          }
      }

      /**
      * Defines wheter to record the history for each hash change in the URL.
      */
      function setRecordHistory(value, type){
          setVariableState('recordHistory', value, type);
      }

      /**
      * Defines the scrolling speed
      */
      function setScrollingSpeed(value, type){
          setVariableState('scrollingSpeed', value, type);
      }

      /**
      * Sets fitToSection
      */
      function setFitToSection(value, type){
          setVariableState('fitToSection', value, type);
      }

      /**
      * Sets lockAnchors
      */
      function setLockAnchors(value){
          options.lockAnchors = value;
      }

      /**
      * Adds or remove the possibility of scrolling through sections by using the mouse wheel or the trackpad.
      */
      function setMouseWheelScrolling(value){
          if(value){
              addMouseWheelHandler();
              addMiddleWheelHandler();
          }else{
              removeMouseWheelHandler();
              removeMiddleWheelHandler();
          }
      }

      /**
      * Adds or remove the possibility of scrolling through sections by using the mouse wheel/trackpad or touch gestures.
      * Optionally a second parameter can be used to specify the direction for which the action will be applied.
      *
      * @param directions string containing the direction or directions separated by comma.
      */
      function setAllowScrolling(value, directions){
          if(typeof directions !== 'undefined'){
              directions = directions.replace(/ /g,'').split(',');

              directions.forEach(function (direction){
                  setIsScrollAllowed(value, direction, 'm');
              });
          }
          else{
              setIsScrollAllowed(value, 'all', 'm');
          }
      }

      /**
      * Adds or remove the mouse wheel hijacking
      */
      function setMouseHijack(value){
          if(value){
              setMouseWheelScrolling(true);
              addTouchHandler();
          }else{
              setMouseWheelScrolling(false);
              removeTouchHandler();
          }
      }

      /**
      * Adds or remove the possibility of scrolling through sections by using the keyboard arrow keys
      */
      function setKeyboardScrolling(value, directions){
          if(typeof directions !== 'undefined'){
              directions = directions.replace(/ /g,'').split(',');

              directions.forEach(function(direction){
                  setIsScrollAllowed(value, direction, 'k');
              });
          }else{
              setIsScrollAllowed(value, 'all', 'k');
              options.keyboardScrolling = value;
          }
      }

      /**
      * Moves the page up one section.
      */
      function moveSectionUp(){
          var prev = prevUntil($(SECTION_ACTIVE_SEL)[0], SECTION_SEL);

          //looping to the bottom if there's no more sections above
          if (!prev && (options.loopTop || options.continuousVertical)) {
              prev = last($(SECTION_SEL));
          }

          if (prev != null) {
              scrollPage(prev, null, true);
          }
      }

      /**
      * Moves the page down one section.
      */
      function moveSectionDown(){
          var next = nextUntil($(SECTION_ACTIVE_SEL)[0], SECTION_SEL);

          //looping to the top if there's no more sections below
          if(!next &&
              (options.loopBottom || options.continuousVertical)){
              next = $(SECTION_SEL)[0];
          }

          if(next != null){
              scrollPage(next, null, false);
          }
      }

      /**
      * Moves the page to the given section and slide with no animation.
      * Anchors or index positions can be used as params.
      */
      function silentMoveTo(sectionAnchor, slideAnchor){
          setScrollingSpeed (0, 'internal');
          moveTo(sectionAnchor, slideAnchor);
          setScrollingSpeed (originals.scrollingSpeed, 'internal');
      }

      /**
      * Moves the page to the given section and slide.
      * Anchors or index positions can be used as params.
      */
      function moveTo(sectionAnchor, slideAnchor){
          var destiny = getSectionByAnchor(sectionAnchor);

          if (typeof slideAnchor !== 'undefined'){
              scrollPageAndSlide(sectionAnchor, slideAnchor);
          }else if(destiny != null){
              scrollPage(destiny);
          }
      }

      /**
      * Slides right the slider of the active section.
      * Optional `section` param.
      */
      function moveSlideRight(section){
          moveSlide('right', section);
      }

      /**
      * Slides left the slider of the active section.
      * Optional `section` param.
      */
      function moveSlideLeft(section){
          moveSlide('left', section);
      }

      /**
       * When resizing is finished, we adjust the slides sizes and positions
       */
      function reBuild(resizing){
          if(hasClass(container, DESTROYED)){ return; }  //nothing to do if the plugin was destroyed

          isResizing = true;

          //updating global vars
          windowsHeight = getWindowHeight();
          windowsWidth = getWindowWidth();

          var sections = $(SECTION_SEL);
          for (var i = 0; i < sections.length; ++i) {
              var section = sections[i];
              var slidesWrap = $(SLIDES_WRAPPER_SEL, section)[0];
              var slides = $(SLIDE_SEL, section);

              //adjusting the height of the table-cell for IE and Firefox
              if(options.verticalCentered){
                  css($(TABLE_CELL_SEL, section), {'height': getTableHeight(section) + 'px'});
              }

              css(section, {'height': windowsHeight + 'px'});

              //adjusting the position fo the FULL WIDTH slides...
              if (slides.length > 1) {
                  landscapeScroll(slidesWrap, $(SLIDE_ACTIVE_SEL, slidesWrap)[0]);
              }
          }

          if(options.scrollOverflow){
              scrollBarHandler.createScrollBarForAll();
          }

          var activeSection = $(SECTION_ACTIVE_SEL)[0];
          var sectionIndex = index(activeSection, SECTION_SEL);

          //isn't it the first section?
          if(sectionIndex){
              //adjusting the position for the current section
              silentMoveTo(sectionIndex + 1);
          }

          isResizing = false;
          if(isFunction( options.afterResize ) && resizing){
              options.afterResize.call(container, window.innerWidth, window.innerHeight);
          }
          if(isFunction( options.afterReBuild ) && !resizing){
              options.afterReBuild.call(container);
          }
      }

      /**
      * Determines whether fullpage.js is in responsive mode or not.
      */
      function isResponsiveMode(){
         return hasClass($body, RESPONSIVE);
      }

      /**
      * Turns fullPage.js to normal scrolling mode when the viewport `width` or `height`
      * are smaller than the set limit values.
      */
      function setResponsive(active){
          var isResponsive = isResponsiveMode();

          if(active){
              if(!isResponsive){
                  setAutoScrolling(false, 'internal');
                  setFitToSection(false, 'internal');
                  hide($(SECTION_NAV_SEL));
                  addClass($body, RESPONSIVE);
                  if(isFunction( options.afterResponsive )){
                      options.afterResponsive.call( container, active);
                  }

                  //when on page load, we will remove scrolloverflow if necessary
                  if(options.scrollOverflow){
                      scrollBarHandler.createScrollBarForAll();
                  }
              }
          }
          else if(isResponsive){
              setAutoScrolling(originals.autoScrolling, 'internal');
              setFitToSection(originals.autoScrolling, 'internal');
              show($(SECTION_NAV_SEL));
              removeClass($body, RESPONSIVE);
              if(isFunction( options.afterResponsive )){
                  options.afterResponsive.call( container, active);
              }
          }
      }

      if(container){
          //public functions
          FP.version = '3.0.8';
          FP.setAutoScrolling = setAutoScrolling;
          FP.setRecordHistory = setRecordHistory;
          FP.setScrollingSpeed = setScrollingSpeed;
          FP.setFitToSection = setFitToSection;
          FP.setLockAnchors = setLockAnchors;
          FP.setMouseWheelScrolling = setMouseWheelScrolling;
          FP.setAllowScrolling = setAllowScrolling;
          FP.setKeyboardScrolling = setKeyboardScrolling;
          FP.moveSectionUp = moveSectionUp;
          FP.moveSectionDown = moveSectionDown;
          FP.silentMoveTo = silentMoveTo;
          FP.moveTo = moveTo;
          FP.moveSlideRight = moveSlideRight;
          FP.moveSlideLeft = moveSlideLeft;
          FP.fitToSection = fitToSection;
          FP.reBuild = reBuild;
          FP.setResponsive = setResponsive;
          FP.getFullpageData = function(){ return options; };
          FP.destroy = destroy;
          FP.getActiveSection = getActiveSection;
          FP.getActiveSlide = getActiveSlide;

          FP.test = {
              top: '0px',
              translate3d: 'translate3d(0px, 0px, 0px)',
              translate3dH: (function(){
                  var a = [];
                  for(var i = 0; i < $(options.sectionSelector, container).length; i++){
                      a.push('translate3d(0px, 0px, 0px)');
                  }
                  return a;
              })(),
              left: (function(){
                  var a = [];
                  for(var i = 0; i < $(options.sectionSelector, container).length; i++){
                      a.push(0);
                  }
                  return a;
              })(),
              options: options,
              setAutoScrolling: setAutoScrolling
          };

          //functions we want to share across files but which are not
          //mean to be used on their own by developers
          FP.shared = {
              afterRenderActions: afterRenderActions,
              isNormalScrollElement: false
          };

          window.fullpage_api = FP;

          //using jQuery initialization? Creating the $.fn.fullpage object
          if(options.$){
              Object.keys(FP).forEach(function (key) {    
                  options.$.fn.fullpage[key] = FP[key];   
              });
          }

          init();

          bindEvents();
      }

      function init(){
          //if css3 is not supported, it will use jQuery animations
          if(options.css3){
              options.css3 = support3d();
          }

          options.scrollBar = options.scrollBar || options.hybrid;

          setOptionsFromDOM();
          prepareDom();
          setAllowScrolling(true);
          setMouseHijack(true);
          setAutoScrolling(options.autoScrolling, 'internal');
          responsive();

          //setting the class for the body element
          setBodyClass();

          if(document.readyState === 'complete'){
              scrollToAnchor();
          }
          window.addEventListener('load', scrollToAnchor);

          //if we use scrollOverflow we'll fire afterRender in the scrolloverflow file
          if(!options.scrollOverflow){
              afterRenderActions();
          }

          doubleCheckHeight();
      }

      function bindEvents(){

          //when scrolling...
          window.addEventListener('scroll', scrollHandler);

          //detecting any change on the URL to scroll to the given anchor link
          //(a way to detect back history button as we play with the hashes on the URL)
          window.addEventListener('hashchange', hashChangeHandler);

          //when opening a new tab (ctrl + t), `control` won't be pressed when coming back.
          window.addEventListener('blur', blurHandler);

          //when resizing the site, we adjust the heights of the sections, slimScroll...
          window.addEventListener('resize', resizeHandler);

          //Sliding with arrow keys, both, vertical and horizontal
          document.addEventListener('keydown', keydownHandler);

          //to prevent scrolling while zooming
          document.addEventListener('keyup', keyUpHandler);

          //Scrolls to the section when clicking the navigation bullet
          //simulating the jQuery .on('click') event using delegation
          ['click', 'touchstart'].forEach(function(eventName){
              document.addEventListener(eventName, delegatedEvents);
          });

          /**
          * Applying normalScroll elements.
          * Ignoring the scrolls over the specified selectors.
          */
          if(options.normalScrollElements){
              ['mouseenter', 'touchstart'].forEach(function(eventName){
                  forMouseLeaveOrTouch(eventName, false);
              });

              ['mouseleave', 'touchend'].forEach(function(eventName){
                 forMouseLeaveOrTouch(eventName, true);
              });
          }
      }

      function delegatedEvents(e){
          var target = e.target;

          if(target && closest(target, SECTION_NAV_SEL + ' a')){
              sectionBulletHandler.call(target, e);
          }
          else if(matches(target, SECTION_NAV_TOOLTIP_SEL)){
              tooltipTextHandler.call(target);
          }
          else if(matches(target, SLIDES_ARROW_SEL)){
              slideArrowHandler.call(target, e);
          }
          else if(matches(target, SLIDES_NAV_LINK_SEL) || closest(target, SLIDES_NAV_LINK_SEL) != null){
              slideBulletHandler.call(target, e);
          }
          else if(closest(target, options.menu + ' [data-menuanchor]')){
              menuItemsHandler.call(target, e);
          }
      }

      function forMouseLeaveOrTouch(eventName, allowScrolling){
          //a way to pass arguments to the onMouseEnterOrLeave function
          document['fp_' + eventName] = allowScrolling;
          document.addEventListener(eventName, onMouseEnterOrLeave, true); //capturing phase
      }

      function onMouseEnterOrLeave(e) {
          var type = e.type;
          var isInsideOneNormalScroll = false;
          var isUsingScrollOverflow = options.scrollOverflow;

          //onMouseLeave will use the destination target, not the one we are moving away from
          var target = type === 'mouseleave' ? e.toElement || e.relatedTarget : e.target;

          //coming from closing a normalScrollElements modal or moving outside viewport?
          if(target == document || !target){
              setMouseHijack(true);

              if(isUsingScrollOverflow){
                  options.scrollOverflowHandler.setIscroll(target, true);
              }
              return;
          }

          if(type === 'touchend'){
              g_canFireMouseEnterNormalScroll = false;
              setTimeout(function(){
                  g_canFireMouseEnterNormalScroll = true;
              }, 800);
          }

          //preventing mouseenter event to do anything when coming from a touchEnd event
          //fixing issue #3576
          if(type === 'mouseenter' && !g_canFireMouseEnterNormalScroll){
              return;
          }

          var normalSelectors = options.normalScrollElements.split(',');

          normalSelectors.forEach(function(normalSelector){
              if(!isInsideOneNormalScroll){
                  var isNormalScrollTarget = matches(target, normalSelector);

                  //leaving a child inside the normalScoll element is not leaving the normalScroll #3661
                  var isNormalScrollChildFocused = closest(target, normalSelector);

                  if(isNormalScrollTarget || isNormalScrollChildFocused){
                      if(!FP.shared.isNormalScrollElement){
                          setMouseHijack(false);

                          if(isUsingScrollOverflow){
                              options.scrollOverflowHandler.setIscroll(target, false);
                          }
                      }
                      FP.shared.isNormalScrollElement = true;
                      isInsideOneNormalScroll = true;
                  }
              }
          });

          //not inside a single normal scroll element anymore?
          if(!isInsideOneNormalScroll && FP.shared.isNormalScrollElement){
              setMouseHijack(true);
              
              if(isUsingScrollOverflow){
                  options.scrollOverflowHandler.setIscroll(target, true);
              }

              FP.shared.isNormalScrollElement = false;
          }
      }

      /**
      * Checks the viewport a few times on a define interval of time to 
      * see if it has changed in any of those. If that's the case, it resizes.
      */
      function doubleCheckHeight(){
          for(var i = 1; i < 4; i++){
              g_doubleCheckHeightId = setTimeout(adjustToNewViewport, 350 * i);
          }
      }

      /**
      * Adjusts a section to the viewport if it has changed.
      */
      function adjustToNewViewport(){
          var newWindowHeight = getWindowHeight();
          var newWindowWidth = getWindowWidth();

          if(windowsHeight !== newWindowHeight || windowsWidth !== newWindowWidth){
              windowsHeight = newWindowHeight;
              windowsWidth = newWindowWidth;
              reBuild(true);
          }
      }

      /**
      * Setting options from DOM elements if they are not provided.
      */
      function setOptionsFromDOM(){

          //no anchors option? Checking for them in the DOM attributes
          if(!options.anchors.length){
              var anchorsAttribute = '[data-anchor]';
              var anchors = $(options.sectionSelector.split(',').join(anchorsAttribute + ',') + anchorsAttribute, container);
              if(anchors.length){
                  g_initialAnchorsInDom = true;
                  anchors.forEach(function(item){
                      options.anchors.push(item.getAttribute('data-anchor').toString());
                  });
              }
          }

          //no tooltips option? Checking for them in the DOM attributes
          if(!options.navigationTooltips.length){
              var tooltipsAttribute = '[data-tooltip]';
              var tooltips = $(options.sectionSelector.split(',').join(tooltipsAttribute + ',') + tooltipsAttribute, container);
              if(tooltips.length){
                  tooltips.forEach(function(item){
                      options.navigationTooltips.push(item.getAttribute('data-tooltip').toString());
                  });
              }
          }
      }

      /**
      * Works over the DOM structure to set it up for the current fullpage options.
      */
      function prepareDom(){
          css(container, {
              'height': '100%',
              'position': 'relative'
          });

          //adding a class to recognize the container internally in the code
          addClass(container, WRAPPER);
          addClass($html, ENABLED);

          //due to https://github.com/alvarotrigo/fullPage.js/issues/1502
          windowsHeight = getWindowHeight();

          removeClass(container, DESTROYED); //in case it was destroyed before initializing it again

          addInternalSelectors();

          var sections = $(SECTION_SEL);

          //styling the sections / slides / menu
          for(var i = 0; i<sections.length; i++){
              var sectionIndex = i;
              var section = sections[i];
              var slides = $(SLIDE_SEL, section);
              var numSlides = slides.length;

              //caching the original styles to add them back on destroy('all')
              section.setAttribute('data-fp-styles', section.getAttribute('style'));

              styleSection(section, sectionIndex);
              styleMenu(section, sectionIndex);

              // if there's any slide
              if (numSlides > 0) {
                  styleSlides(section, slides, numSlides);
              }else{
                  if(options.verticalCentered){
                      addTableClass(section);
                  }
              }
          }

          //fixed elements need to be moved out of the plugin container due to problems with CSS3.
          if(options.fixedElements && options.css3){
              $(options.fixedElements).forEach(function(item){
                  $body.appendChild(item);
              });
          }

          //vertical centered of the navigation + active bullet
          if(options.navigation){
              addVerticalNavigation();
          }

          enableYoutubeAPI();

          if(options.scrollOverflow){
              scrollBarHandler = options.scrollOverflowHandler.init(options);
          }
      }

      /**
      * Styles the horizontal slides for a section.
      */
      function styleSlides(section, slides, numSlides){
          var sliderWidth = numSlides * 100;
          var slideWidth = 100 / numSlides;

          var slidesWrapper = document.createElement('div');
          slidesWrapper.className = SLIDES_WRAPPER; //fp-slides
          wrapAll(slides, slidesWrapper);

          var slidesContainer = document.createElement('div');
          slidesContainer.className = SLIDES_CONTAINER; //fp-slidesContainer
          wrapAll(slides, slidesContainer);

          css($(SLIDES_CONTAINER_SEL, section), {'width': sliderWidth + '%'});

          if(numSlides > 1){
              if(options.controlArrows){
                  createSlideArrows(section);
              }

              if(options.slidesNavigation){
                  addSlidesNavigation(section, numSlides);
              }
          }

          slides.forEach(function(slide) {
              css(slide, {'width': slideWidth + '%'});

              if(options.verticalCentered){
                  addTableClass(slide);
              }
          });

          var startingSlide = $(SLIDE_ACTIVE_SEL, section)[0];

          //if the slide won't be an starting point, the default will be the first one
          //the active section isn't the first one? Is not the first slide of the first section? Then we load that section/slide by default.
          if( startingSlide != null && (index($(SECTION_ACTIVE_SEL), SECTION_SEL) !== 0 || (index($(SECTION_ACTIVE_SEL), SECTION_SEL) === 0 && index(startingSlide) !== 0))){
              silentLandscapeScroll(startingSlide, 'internal');
          }else{
              addClass(slides[0], ACTIVE);
          }
      }

      /**
      * Styling vertical sections
      */
      function styleSection(section, index){
          //if no active section is defined, the 1st one will be the default one
          if(!index && $(SECTION_ACTIVE_SEL)[0] == null) {
              addClass(section, ACTIVE);
          }
          startingSection = $(SECTION_ACTIVE_SEL)[0];

          css(section, {'height': windowsHeight + 'px'});

          if(options.paddingTop){
              css(section, {'padding-top': options.paddingTop});
          }

          if(options.paddingBottom){
              css(section, {'padding-bottom': options.paddingBottom});
          }

          if (typeof options.sectionsColor[index] !==  'undefined') {
              css(section, {'background-color': options.sectionsColor[index]});
          }

          if (typeof options.anchors[index] !== 'undefined') {
              section.setAttribute('data-anchor', options.anchors[index]);
          }
      }

      /**
      * Sets the data-anchor attributes to the menu elements and activates the current one.
      */
      function styleMenu(section, index){
          if (typeof options.anchors[index] !== 'undefined') {
              //activating the menu / nav element on load
              if(hasClass(section, ACTIVE)){
                  activateMenuAndNav(options.anchors[index], index);
              }
          }

          //moving the menu outside the main container if it is inside (avoid problems with fixed positions when using CSS3 tranforms)
          if(options.menu && options.css3 && closest($(options.menu)[0], WRAPPER_SEL) != null){
              $(options.menu).forEach(function(menu) {
                  $body.appendChild(menu);
              });
          }
      }

      /**
      * Adds internal classes to be able to provide customizable selectors
      * keeping the link with the style sheet.
      */
      function addInternalSelectors(){
          addClass($(options.sectionSelector, container), SECTION);
          addClass($(options.slideSelector, container), SLIDE);
      }

      /**
      * Creates the control arrows for the given section
      */
      function createSlideArrows(section){
          var arrows = [createElementFromHTML('<div class="' + SLIDES_ARROW_PREV + '"></div>'), createElementFromHTML('<div class="' + SLIDES_ARROW_NEXT + '"></div>')];
          after($(SLIDES_WRAPPER_SEL, section)[0], arrows);

          if(options.controlArrowColor !== '#fff'){
              css($(SLIDES_ARROW_NEXT_SEL, section), {'border-color': 'transparent transparent transparent '+options.controlArrowColor});
              css($(SLIDES_ARROW_PREV_SEL, section), {'border-color': 'transparent '+ options.controlArrowColor + ' transparent transparent'});
          }

          if(!options.loopHorizontal){
              hide($(SLIDES_ARROW_PREV_SEL, section));
          }
      }

      /**
      * Creates a vertical navigation bar.
      */
      function addVerticalNavigation(){
          var navigation = document.createElement('div');
          navigation.setAttribute('id', SECTION_NAV);

          var divUl = document.createElement('ul');
          navigation.appendChild(divUl);

          appendTo(navigation, $body);
          var nav = $(SECTION_NAV_SEL)[0];

          addClass(nav, 'fp-' + options.navigationPosition);

          if(options.showActiveTooltip){
              addClass(nav, SHOW_ACTIVE_TOOLTIP);
          }

          var li = '';

          for (var i = 0; i < $(SECTION_SEL).length; i++) {
              var link = '';
              if (options.anchors.length) {
                  link = options.anchors[i];
              }

              li += '<li><a href="#' + link + '"><span class="fp-sr-only">' + getBulletLinkName(i, 'Section') + '</span><span></span></a>';

              // Only add tooltip if needed (defined by user)
              var tooltip = options.navigationTooltips[i];

              if (typeof tooltip !== 'undefined' && tooltip !== '') {
                  li += '<div class="' + SECTION_NAV_TOOLTIP + ' fp-' + options.navigationPosition + '">' + tooltip + '</div>';
              }

              li += '</li>';
          }
          $('ul', nav)[0].innerHTML = li;

          //centering it vertically
          css($(SECTION_NAV_SEL), {'margin-top': '-' + ($(SECTION_NAV_SEL)[0].offsetHeight/2) + 'px'});

          //activating the current active section

          var bullet = $('li', $(SECTION_NAV_SEL)[0])[index($(SECTION_ACTIVE_SEL)[0], SECTION_SEL)];
          addClass($('a', bullet), ACTIVE);
      }

      /**
      * Gets the name for screen readers for a section/slide navigation bullet.
      */
      function getBulletLinkName(i, defaultName){
          return options.navigationTooltips[i]
              || options.anchors[i]
              || defaultName + ' ' + (i+1);
      }

      /*
      * Enables the Youtube videos API so we can control their flow if necessary.
      */
      function enableYoutubeAPI(){
          $('iframe[src*="youtube.com/embed/"]', container).forEach(function(item){
              addURLParam(item, 'enablejsapi=1');
          });
      }

      /**
      * Adds a new parameter and its value to the `src` of a given element
      */
      function addURLParam(element, newParam){
          var originalSrc = element.getAttribute('src');
          element.setAttribute('src', originalSrc + getUrlParamSign(originalSrc) + newParam);
      }

      /*
      * Returns the prefix sign to use for a new parameter in an existen URL.
      *
      * @return {String}  ? | &
      */
      function getUrlParamSign(url){
          return ( !/\?/.test( url ) ) ? '?' : '&';
      }

      /**
      * Actions and callbacks to fire afterRender
      */
      function afterRenderActions(){
          var section = $(SECTION_ACTIVE_SEL)[0];

          addClass(section, COMPLETELY);

          lazyLoad(section);
          lazyLoadOthers();
          playMedia(section);

          if(options.scrollOverflow){
              options.scrollOverflowHandler.afterLoad();
          }

          if(isDestinyTheStartingSection() && isFunction(options.afterLoad) ){
              fireCallback('afterLoad', {
                  activeSection: section,
                  element: section,
                  direction: null,

                  //for backwards compatibility callback (to be removed in a future!)
                  anchorLink: section.getAttribute('data-anchor'),
                  sectionIndex: index(section, SECTION_SEL)
              });
          }

          if(isFunction(options.afterRender)){
              fireCallback('afterRender');
          }
      }

      /**
      * Determines if the URL anchor destiny is the starting section (the one using 'active' class before initialization)
      */
      function isDestinyTheStartingSection(){
          var anchor = getAnchorsURL();
          var destinationSection = getSectionByAnchor(anchor.section);
          return !anchor.section || !destinationSection || typeof destinationSection !=='undefined' && index(destinationSection) === index(startingSection);
      }

      var isScrolling = false;
      var lastScroll = 0;

      //when scrolling...
      function scrollHandler(){
          var currentSection;

          if(!options.autoScrolling || options.scrollBar){
              var currentScroll = getScrollTop();
              var scrollDirection = getScrollDirection(currentScroll);
              var visibleSectionIndex = 0;
              var screen_mid = currentScroll + (getWindowHeight() / 2.0);
              var isAtBottom = $body.offsetHeight - getWindowHeight() === currentScroll;
              var sections =  $(SECTION_SEL);

              //when using `auto-height` for a small last section it won't be centered in the viewport
              if(isAtBottom){
                  visibleSectionIndex = sections.length - 1;
              }
              //is at top? when using `auto-height` for a small first section it won't be centered in the viewport
              else if(!currentScroll){
                  visibleSectionIndex = 0;
              }

              //taking the section which is showing more content in the viewport
              else{
                  for (var i = 0; i < sections.length; ++i) {
                      var section = sections[i];

                      // Pick the the last section which passes the middle line of the screen.
                      if (section.offsetTop <= screen_mid)
                      {
                          visibleSectionIndex = i;
                      }
                  }
              }

              if(isCompletelyInViewPort(scrollDirection)){
                  if(!hasClass($(SECTION_ACTIVE_SEL)[0], COMPLETELY)){
                      addClass($(SECTION_ACTIVE_SEL)[0], COMPLETELY);
                      removeClass(siblings($(SECTION_ACTIVE_SEL)[0]), COMPLETELY);
                  }
              }

              //geting the last one, the current one on the screen
              currentSection = sections[visibleSectionIndex];

              //setting the visible section as active when manually scrolling
              //executing only once the first time we reach the section
              if(!hasClass(currentSection, ACTIVE)){
                  isScrolling = true;
                  var leavingSection = $(SECTION_ACTIVE_SEL)[0];
                  var leavingSectionIndex = index(leavingSection, SECTION_SEL) + 1;
                  var yMovement = getYmovement(currentSection);
                  var anchorLink  = currentSection.getAttribute('data-anchor');
                  var sectionIndex = index(currentSection, SECTION_SEL) + 1;
                  var activeSlide = $(SLIDE_ACTIVE_SEL, currentSection)[0];
                  var slideIndex;
                  var slideAnchorLink;
                  var callbacksParams = {
                      activeSection: leavingSection,
                      sectionIndex: sectionIndex -1,
                      anchorLink: anchorLink,
                      element: currentSection,
                      leavingSection: leavingSectionIndex,
                      direction: yMovement
                  };

                  if(activeSlide){
                      slideAnchorLink = activeSlide.getAttribute('data-anchor');
                      slideIndex = index(activeSlide);
                  }

                  if(canScroll){
                      addClass(currentSection, ACTIVE);
                      removeClass(siblings(currentSection), ACTIVE);

                      if(isFunction( options.onLeave )){
                          fireCallback('onLeave', callbacksParams);
                      }
                      if(isFunction( options.afterLoad )){
                          fireCallback('afterLoad', callbacksParams);
                      }

                      stopMedia(leavingSection);
                      lazyLoad(currentSection);
                      playMedia(currentSection);

                      activateMenuAndNav(anchorLink, sectionIndex - 1);

                      if(options.anchors.length){
                          //needed to enter in hashChange event when using the menu with anchor links
                          lastScrolledDestiny = anchorLink;
                      }
                      setState(slideIndex, slideAnchorLink, anchorLink, sectionIndex);
                  }

                  //small timeout in order to avoid entering in hashChange event when scrolling is not finished yet
                  clearTimeout(scrollId);
                  scrollId = setTimeout(function(){
                      isScrolling = false;
                  }, 100);
              }

              if(options.fitToSection){
                  //for the auto adjust of the viewport to fit a whole section
                  clearTimeout(scrollId2);

                  scrollId2 = setTimeout(function(){
                      //checking it again in case it changed during the delay
                      if(options.fitToSection &&

                          //is the destination element bigger than the viewport?
                          $(SECTION_ACTIVE_SEL)[0].offsetHeight <= windowsHeight
                      ){
                          fitToSection();
                      }
                  }, options.fitToSectionDelay);
              }
          }
      }

      /**
      * Fits the site to the nearest active section
      */
      function fitToSection(){
          //checking fitToSection again in case it was set to false before the timeout delay
          if(canScroll){
              //allows to scroll to an active section and
              //if the section is already active, we prevent firing callbacks
              isResizing = true;

              scrollPage($(SECTION_ACTIVE_SEL)[0]);
              isResizing = false;
          }
      }

      /**
      * Determines whether the active section has seen in its whole or not.
      */
      function isCompletelyInViewPort(movement){
          var top = $(SECTION_ACTIVE_SEL)[0].offsetTop;
          var bottom = top + getWindowHeight();

          if(movement == 'up'){
              return bottom >= (getScrollTop() + getWindowHeight());
          }
          return top <= getScrollTop();
      }

      /**
      * Determines whether a section is in the viewport or not.
      */
      function isSectionInViewport (el) {
          var rect = el.getBoundingClientRect();
          var top = rect.top;
          var bottom = rect.bottom;

          //sometimes there's a 1px offset on the bottom of the screen even when the 
          //section's height is the window.innerHeight one. I guess because pixels won't allow decimals.
          //using this prevents from lazyLoading the section that is not yet visible 
          //(only 1 pixel offset is)
          var pixelOffset = 2;
          
          var isTopInView = top + pixelOffset < windowsHeight && top > 0;
          var isBottomInView = bottom > pixelOffset && bottom < windowsHeight;

          return isTopInView || isBottomInView;
      }

      /**
      * Gets the directon of the the scrolling fired by the scroll event.
      */
      function getScrollDirection(currentScroll){
          var direction = currentScroll > lastScroll ? 'down' : 'up';

          lastScroll = currentScroll;

          //needed for auto-height sections to determine if we want to scroll to the top or bottom of the destination
          previousDestTop = currentScroll;

          return direction;
      }

      /**
      * Determines the way of scrolling up or down:
      * by 'automatically' scrolling a section or by using the default and normal scrolling.
      */
      function scrolling(type){
          if (!isScrollAllowed.m[type]){
              return;
          }

          var scrollSection = (type === 'down') ? moveSectionDown : moveSectionUp;

          if(options.scrollOverflow){
              var scrollable = options.scrollOverflowHandler.scrollable($(SECTION_ACTIVE_SEL)[0]);
              var check = (type === 'down') ? 'bottom' : 'top';

              if(scrollable != null ){
                  //is the scrollbar at the start/end of the scroll?
                  if(options.scrollOverflowHandler.isScrolled(check, scrollable)){
                      scrollSection();
                  }else{
                      return true;
                  }
              }else{
                  // moved up/down
                  scrollSection();
              }
          }else{
              // moved up/down
              scrollSection();
          }
      }

      /*
      * Preventing bouncing in iOS #2285
      */
      function preventBouncing(e){
          if(options.autoScrolling && isReallyTouch(e) && isScrollAllowed.m.up){
              //preventing the easing on iOS devices
              preventDefault(e);
          }
      }

      var touchStartY = 0;
      var touchStartX = 0;
      var touchEndY = 0;
      var touchEndX = 0;

      /* Detecting touch events

      * As we are changing the top property of the page on scrolling, we can not use the traditional way to detect it.
      * This way, the touchstart and the touch moves shows an small difference between them which is the
      * used one to determine the direction.
      */
      function touchMoveHandler(e){
          var activeSection = closest(e.target, SECTION_SEL) || $(SECTION_ACTIVE_SEL)[0];

          if (isReallyTouch(e) ) {

              if(options.autoScrolling){
                  //preventing the easing on iOS devices
                  preventDefault(e);
              }

              var touchEvents = getEventsPage(e);

              touchEndY = touchEvents.y;
              touchEndX = touchEvents.x;

              //if movement in the X axys is greater than in the Y and the currect section has slides...
              if ($(SLIDES_WRAPPER_SEL, activeSection).length && Math.abs(touchStartX - touchEndX) > (Math.abs(touchStartY - touchEndY))) {

                  //is the movement greater than the minimum resistance to scroll?
                  if (!slideMoving && Math.abs(touchStartX - touchEndX) > (getWindowWidth() / 100 * options.touchSensitivity)) {
                      if (touchStartX > touchEndX) {
                          if(isScrollAllowed.m.right){
                              moveSlideRight(activeSection); //next
                          }
                      } else {
                          if(isScrollAllowed.m.left){
                              moveSlideLeft(activeSection); //prev
                          }
                      }
                  }
              }

              //vertical scrolling (only when autoScrolling is enabled)
              else if(options.autoScrolling && canScroll){

                  //is the movement greater than the minimum resistance to scroll?
                  if (Math.abs(touchStartY - touchEndY) > (window.innerHeight / 100 * options.touchSensitivity)) {
                      if (touchStartY > touchEndY) {
                          scrolling('down');
                      } else if (touchEndY > touchStartY) {
                          scrolling('up');
                      }
                  }
              }
          }
      }

      /**
      * As IE >= 10 fires both touch and mouse events when using a mouse in a touchscreen
      * this way we make sure that is really a touch event what IE is detecting.
      */
      function isReallyTouch(e){
          //if is not IE   ||  IE is detecting `touch` or `pen`
          return typeof e.pointerType === 'undefined' || e.pointerType != 'mouse';
      }

      /**
      * Handler for the touch start event.
      */
      function touchStartHandler(e){

          //stopping the auto scroll to adjust to a section
          if(options.fitToSection){
              activeAnimation = false;
          }

          if(isReallyTouch(e)){
              var touchEvents = getEventsPage(e);
              touchStartY = touchEvents.y;
              touchStartX = touchEvents.x;
          }
      }

      /**
      * Gets the average of the last `number` elements of the given array.
      */
      function getAverage(elements, number){
          var sum = 0;

          //taking `number` elements from the end to make the average, if there are not enought, 1
          var lastElements = elements.slice(Math.max(elements.length - number, 1));

          for(var i = 0; i < lastElements.length; i++){
              sum = sum + lastElements[i];
          }

          return Math.ceil(sum/number);
      }

      /**
       * Detecting mousewheel scrolling
       *
       * http://blogs.sitepointstatic.com/examples/tech/mouse-wheel/index.html
       * http://www.sitepoint.com/html5-javascript-mouse-wheel/
       */
      var prevTime = new Date().getTime();

      function MouseWheelHandler(e) {
          var curTime = new Date().getTime();
          var isNormalScroll = hasClass($(COMPLETELY_SEL)[0], NORMAL_SCROLL);

          //is scroll allowed?
          if (!isScrollAllowed.m.down && !isScrollAllowed.m.up) {
              preventDefault(e);
              return false;
          }

          //autoscrolling and not zooming?
          if(options.autoScrolling && !controlPressed && !isNormalScroll){
              // cross-browser wheel delta
              e = e || window.event;
              var value = e.wheelDelta || -e.deltaY || -e.detail;
              var delta = Math.max(-1, Math.min(1, value));

              var horizontalDetection = typeof e.wheelDeltaX !== 'undefined' || typeof e.deltaX !== 'undefined';
              var isScrollingVertically = (Math.abs(e.wheelDeltaX) < Math.abs(e.wheelDelta)) || (Math.abs(e.deltaX ) < Math.abs(e.deltaY) || !horizontalDetection);

              //Limiting the array to 150 (lets not waste memory!)
              if(scrollings.length > 149){
                  scrollings.shift();
              }

              //keeping record of the previous scrollings
              scrollings.push(Math.abs(value));

              //preventing to scroll the site on mouse wheel when scrollbar is present
              if(options.scrollBar){
                  preventDefault(e);
              }

              //time difference between the last scroll and the current one
              var timeDiff = curTime-prevTime;
              prevTime = curTime;

              //haven't they scrolled in a while?
              //(enough to be consider a different scrolling action to scroll another section)
              if(timeDiff > 200){
                  //emptying the array, we dont care about old scrollings for our averages
                  scrollings = [];
              }

              if(canScroll){
                  var averageEnd = getAverage(scrollings, 10);
                  var averageMiddle = getAverage(scrollings, 70);
                  var isAccelerating = averageEnd >= averageMiddle;

                  //to avoid double swipes...
                  if(isAccelerating && isScrollingVertically){
                      //scrolling down?
                      if (delta < 0) {
                          scrolling('down');

                      //scrolling up?
                      }else {
                          scrolling('up');
                      }
                  }
              }

              return false;
          }

          if(options.fitToSection){
              //stopping the auto scroll to adjust to a section
              activeAnimation = false;
          }
      }

      /**
      * Slides a slider to the given direction.
      * Optional `section` param.
      */
      function moveSlide(direction, section){
          var activeSection = section == null ? $(SECTION_ACTIVE_SEL)[0] : section;
          var slides = $(SLIDES_WRAPPER_SEL, activeSection)[0];

          // more than one slide needed and nothing should be sliding
          if (slides == null || slideMoving || $(SLIDE_SEL, slides).length < 2) {
              return;
          }

          var currentSlide = $(SLIDE_ACTIVE_SEL, slides)[0];
          var destiny = null;

          if(direction === 'left'){
              destiny = prevUntil(currentSlide, SLIDE_SEL);
          }else{
              destiny = nextUntil(currentSlide, SLIDE_SEL);
          }

          //isn't there a next slide in the secuence?
          if(destiny == null){
              //respect loopHorizontal settin
              if (!options.loopHorizontal) return;

              var slideSiblings = siblings(currentSlide);
              if(direction === 'left'){
                  destiny = slideSiblings[slideSiblings.length - 1]; //last
              }else{
                  destiny = slideSiblings[0]; //first
              }
          }

          slideMoving = true && !FP.test.isTesting;
          landscapeScroll(slides, destiny, direction);
      }

      /**
      * Maintains the active slides in the viewport
      * (Because the `scroll` animation might get lost with some actions, such as when using continuousVertical)
      */
      function keepSlidesPosition(){
          var activeSlides = $(SLIDE_ACTIVE_SEL);
          for( var i =0; i<activeSlides.length; i++){
              silentLandscapeScroll(activeSlides[i], 'internal');
          }
      }

      var previousDestTop = 0;
      /**
      * Returns the destination Y position based on the scrolling direction and
      * the height of the section.
      */
      function getDestinationPosition(element){
          var elementHeight = element.offsetHeight;
          var elementTop = element.offsetTop;

          //top of the desination will be at the top of the viewport
          var position = elementTop;
          var isScrollingDown =  elementTop > previousDestTop;
          var sectionBottom = position - windowsHeight + elementHeight;
          var bigSectionsDestination = options.bigSectionsDestination;

          //is the destination element bigger than the viewport?
          if(elementHeight > windowsHeight){
              //scrolling up?
              if(!isScrollingDown && !bigSectionsDestination || bigSectionsDestination === 'bottom' ){
                  position = sectionBottom;
              }
          }

          //sections equal or smaller than the viewport height && scrolling down? ||  is resizing and its in the last section
          else if(isScrollingDown || (isResizing && next(element) == null) ){
              //The bottom of the destination will be at the bottom of the viewport
              position = sectionBottom;
          }

          /*
          Keeping record of the last scrolled position to determine the scrolling direction.
          No conventional methods can be used as the scroll bar might not be present
          AND the section might not be active if it is auto-height and didnt reach the middle
          of the viewport.
          */
          previousDestTop = position;
          return position;
      }

      /**
      * Scrolls the site to the given element and scrolls to the slide if a callback is given.
      */
      function scrollPage(element, callback, isMovementUp){
          if(element == null){ return; } //there's no element to scroll, leaving the function

          var dtop = getDestinationPosition(element);
          var slideAnchorLink;
          var slideIndex;

          //local variables
          var v = {
              element: element,
              callback: callback,
              isMovementUp: isMovementUp,
              dtop: dtop,
              yMovement: getYmovement(element),
              anchorLink: element.getAttribute('data-anchor'),
              sectionIndex: index(element, SECTION_SEL),
              activeSlide: $(SLIDE_ACTIVE_SEL, element)[0],
              activeSection: $(SECTION_ACTIVE_SEL)[0],
              leavingSection: index($(SECTION_ACTIVE_SEL), SECTION_SEL) + 1,

              //caching the value of isResizing at the momment the function is called
              //because it will be checked later inside a setTimeout and the value might change
              localIsResizing: isResizing
          };

          //quiting when destination scroll is the same as the current one
          if((v.activeSection == element && !isResizing) || (options.scrollBar && getScrollTop() === v.dtop && !hasClass(element, AUTO_HEIGHT) )){ return; }

          if(v.activeSlide != null){
              slideAnchorLink = v.activeSlide.getAttribute('data-anchor');
              slideIndex = index(v.activeSlide);
          }

          //callback (onLeave) if the site is not just resizing and readjusting the slides
          if(!v.localIsResizing){
              var direction = v.yMovement;

              //required for continousVertical
              if(typeof isMovementUp !== 'undefined'){
                  direction = isMovementUp ? 'up' : 'down';
              }

              //for the callback
              v.direction = direction;

              if(isFunction(options.onLeave)){
                  if(fireCallback('onLeave', v) === false){
                      return;
                  }
              }
          }

          // If continuousVertical && we need to wrap around
          if (options.autoScrolling && options.continuousVertical && typeof (v.isMovementUp) !== "undefined" &&
              ((!v.isMovementUp && v.yMovement == 'up') || // Intending to scroll down but about to go up or
              (v.isMovementUp && v.yMovement == 'down'))) { // intending to scroll up but about to go down

              v = createInfiniteSections(v);
          }

          //pausing media of the leaving section (if we are not just resizing, as destinatino will be the same one)
          if(!v.localIsResizing){
              stopMedia(v.activeSection);
          }

          if(options.scrollOverflow){
              options.scrollOverflowHandler.beforeLeave();
          }

          addClass(element, ACTIVE);
          removeClass(siblings(element), ACTIVE);
          lazyLoad(element);

          if(options.scrollOverflow){
              options.scrollOverflowHandler.onLeave();
          }

          //preventing from activating the MouseWheelHandler event
          //more than once if the page is scrolling
          canScroll = false || FP.test.isTesting;

          setState(slideIndex, slideAnchorLink, v.anchorLink, v.sectionIndex);

          performMovement(v);

          //flag to avoid callingn `scrollPage()` twice in case of using anchor links
          lastScrolledDestiny = v.anchorLink;

          //avoid firing it twice (as it does also on scroll)
          activateMenuAndNav(v.anchorLink, v.sectionIndex);
      }

      /**
      * Dispatch events & callbacks making sure it does it on the right format, depending on
      * whether v2compatible is being used or not.
      */
      function fireCallback(eventName, v){
          var eventData = getEventData(eventName, v);

          if(!options.v2compatible){
              trigger(container, eventName, eventData);

              if(options[eventName].apply(eventData[Object.keys(eventData)[0]], toArray(eventData)) === false){
                  return false;
              }
          }
          else{
              if(options[eventName].apply(eventData[0], eventData.slice(1)) === false){
                  return false;
              }
          }

          return true;
      }

      /**
      * Makes sure to only create a Panel object if the element exist
      */
      function nullOrSection(el){
          return el ? new Section(el) : null;
      }

      function nullOrSlide(el){
          return el ? new Slide(el) : null;
      }

      /**
      * Gets the event's data for the given event on the right format. Depending on whether
      * v2compatible is being used or not.
      */
      function getEventData(eventName, v){
          var paramsPerEvent;

          if(!options.v2compatible){

              //using functions to run only the necessary bits within the object
              paramsPerEvent = {
                  afterRender: function(){
                      return {
                          section: nullOrSection($(SECTION_ACTIVE_SEL)[0]),
                          slide: nullOrSlide($(SLIDE_ACTIVE_SEL, $(SECTION_ACTIVE_SEL)[0])[0])
                      };
                  },
                  onLeave: function(){
                      return {
                          origin: nullOrSection(v.activeSection),
                          destination: nullOrSection(v.element),
                          direction: v.direction
                      };
                  },

                  afterLoad: function(){
                      return paramsPerEvent.onLeave();
                  },

                  afterSlideLoad: function(){
                      return {
                          section: nullOrSection(v.section),
                          origin: nullOrSlide(v.prevSlide),
                          destination: nullOrSlide(v.destiny),
                          direction: v.direction
                      };
                  },

                  onSlideLeave: function(){
                      return paramsPerEvent.afterSlideLoad();
                  }
              };
          }
          else{
              paramsPerEvent = {
                  afterRender: function(){ return [container]; },
                  onLeave: function(){ return [v.activeSection, v.leavingSection, (v.sectionIndex + 1), v.direction]; },
                  afterLoad: function(){ return [v.element, v.anchorLink, (v.sectionIndex + 1)]; },
                  afterSlideLoad: function(){ return [v.destiny, v.anchorLink, (v.sectionIndex + 1), v.slideAnchor, v.slideIndex]; },
                  onSlideLeave: function(){ return [v.prevSlide, v.anchorLink, (v.sectionIndex + 1), v.prevSlideIndex, v.direction, v.slideIndex]; },
              };
          }

          return paramsPerEvent[eventName]();
      }

      /**
      * Performs the vertical movement (by CSS3 or by jQuery)
      */
      function performMovement(v){
          // using CSS3 translate functionality
          if (options.css3 && options.autoScrolling && !options.scrollBar) {

              // The first section can have a negative value in iOS 10. Not quite sure why: -0.0142822265625
              // that's why we round it to 0.
              var translate3d = 'translate3d(0px, -' + Math.round(v.dtop) + 'px, 0px)';
              transformContainer(translate3d, true);

              //even when the scrollingSpeed is 0 there's a little delay, which might cause the
              //scrollingSpeed to change in case of using silentMoveTo();
              if(options.scrollingSpeed){
                  clearTimeout(afterSectionLoadsId);
                  afterSectionLoadsId = setTimeout(function () {
                      afterSectionLoads(v);
                  }, options.scrollingSpeed);
              }else{
                  afterSectionLoads(v);
              }
          }

          // using JS to animate
          else{
              var scrollSettings = getScrollSettings(v.dtop);
              FP.test.top = -v.dtop + 'px';

              scrollTo(scrollSettings.element, scrollSettings.options, options.scrollingSpeed, function(){
                  if(options.scrollBar){

                      /* Hack!
                      The timeout prevents setting the most dominant section in the viewport as "active" when the user
                      scrolled to a smaller section by using the mousewheel (auto scrolling) rather than draging the scroll bar.

                      When using scrollBar:true It seems like the scroll events still getting propagated even after the scrolling animation has finished.
                      */
                      setTimeout(function(){
                          afterSectionLoads(v);
                      },30);
                  }else{
                      afterSectionLoads(v);
                  }
              });
          }
      }

      /**
      * Gets the scrolling settings depending on the plugin autoScrolling option
      */
      function getScrollSettings(top){
          var scroll = {};

          //top property animation
          if(options.autoScrolling && !options.scrollBar){
              scroll.options = -top;
              scroll.element = $(WRAPPER_SEL)[0];
          }

          //window real scrolling
          else{
              scroll.options = top;
              scroll.element = window;
          }

          return scroll;
      }

      /**
      * Adds sections before or after the current one to create the infinite effect.
      */
      function createInfiniteSections(v){
          // Scrolling down
          if (!v.isMovementUp) {
              // Move all previous sections to after the active section
              after($(SECTION_ACTIVE_SEL)[0], prevAll(v.activeSection, SECTION_SEL).reverse());
          }
          else { // Scrolling up
              // Move all next sections to before the active section
              before($(SECTION_ACTIVE_SEL)[0], nextAll(v.activeSection, SECTION_SEL));
          }

          // Maintain the displayed position (now that we changed the element order)
          silentScroll($(SECTION_ACTIVE_SEL)[0].offsetTop);

          // Maintain the active slides visible in the viewport
          keepSlidesPosition();

          // save for later the elements that still need to be reordered
          v.wrapAroundElements = v.activeSection;

          // Recalculate animation variables
          v.dtop = v.element.offsetTop;
          v.yMovement = getYmovement(v.element);

          return v;
      }

      /**
      * Fix section order after continuousVertical changes have been animated
      */
      function continuousVerticalFixSectionOrder (v) {
          // If continuousVertical is in effect (and autoScrolling would also be in effect then),
          // finish moving the elements around so the direct navigation will function more simply
          if (v.wrapAroundElements == null) {
              return;
          }

          if (v.isMovementUp) {
              before($(SECTION_SEL)[0], v.wrapAroundElements);
          }
          else {
              after($(SECTION_SEL)[$(SECTION_SEL).length-1], v.wrapAroundElements);
          }

          silentScroll($(SECTION_ACTIVE_SEL)[0].offsetTop);

          // Maintain the active slides visible in the viewport
          keepSlidesPosition();
      }

      /**
      * Actions to do once the section is loaded.
      */
      function afterSectionLoads (v){
          continuousVerticalFixSectionOrder(v);

          //callback (afterLoad) if the site is not just resizing and readjusting the slides
          if(isFunction(options.afterLoad) && !v.localIsResizing){
              fireCallback('afterLoad', v);
          }

          if(options.scrollOverflow){
              options.scrollOverflowHandler.afterLoad();
          }

          if(!v.localIsResizing){
              playMedia(v.element);
          }

          addClass(v.element, COMPLETELY);
          removeClass(siblings(v.element), COMPLETELY);
          lazyLoadOthers();

          canScroll = true;

          if(isFunction(v.callback)){
              v.callback();
          }
      }

      /**
      * Sets the value for the given attribute from the `data-` attribute with the same suffix
      * ie: data-srcset ==> srcset  |  data-src ==> src
      */
      function setSrc(element, attribute){
          element.setAttribute(attribute, element.getAttribute('data-' + attribute));
          element.removeAttribute('data-' + attribute);
      }

      /**
      * Makes sure lazyload is done for other sections in the viewport that are not the
      * active one. 
      */
      function lazyLoadOthers(){
          var hasAutoHeightSections = $(AUTO_HEIGHT_SEL)[0] || isResponsiveMode() && $(AUTO_HEIGHT_RESPONSIVE_SEL)[0];

          //quitting when it doesn't apply
          if (!options.lazyLoading || !hasAutoHeightSections){
              return;
          }

          //making sure to lazy load auto-height sections that are in the viewport
          $(SECTION_SEL + ':not(' + ACTIVE_SEL + ')').forEach(function(section){
              if(isSectionInViewport(section)){
                  lazyLoad(section);
              }
          });
      }

      /**
      * Lazy loads image, video and audio elements.
      */
      function lazyLoad(destiny){
          if (!options.lazyLoading){
              return;
          }

          var panel = getSlideOrSection(destiny);

          $('img[data-src], img[data-srcset], source[data-src], source[data-srcset], video[data-src], audio[data-src], iframe[data-src]', panel).forEach(function(element){
              ['src', 'srcset'].forEach(function(type){
                  var attribute = element.getAttribute('data-' + type);
                  if(attribute != null && attribute){
                      setSrc(element, type);
                      element.addEventListener('load', function(){
                          onMediaLoad(destiny);
                      });
                  }
              });

              if(matches(element, 'source')){
                  var elementToPlay =  closest(element, 'video, audio');
                  if(elementToPlay){
                      elementToPlay.load();
                      elementToPlay.onloadeddata = function(){
                          onMediaLoad(destiny);
                      };
                  }
              }
          });
      }

      /**
      * Callback firing when a lazy load media element has loaded.
      * Making sure it only fires one per section in normal conditions (if load time is not huge)
      */
      function onMediaLoad(section){
          if(options.scrollOverflow){
              clearTimeout(g_mediaLoadedId);
              g_mediaLoadedId = setTimeout(function(){
                  scrollBarHandler.createScrollBar(section);
              }, 200);
          }
      }

      /**
      * Plays video and audio elements.
      */
      function playMedia(destiny){
          var panel = getSlideOrSection(destiny);

          //playing HTML5 media elements
          $('video, audio', panel).forEach(function(element){
              if( element.hasAttribute('data-autoplay') && typeof element.play === 'function' ) {
                  element.play();
              }
          });

          //youtube videos
          $('iframe[src*="youtube.com/embed/"]', panel).forEach(function(element){
              if ( element.hasAttribute('data-autoplay') ){
                  playYoutube(element);
              }

              //in case the URL was not loaded yet. On page load we need time for the new URL (with the API string) to load.
              element.onload = function() {
                  if ( element.hasAttribute('data-autoplay') ){
                      playYoutube(element);
                  }
              };
          });
      }

      /**
      * Plays a youtube video
      */
      function playYoutube(element){
          element.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }

      /**
      * Stops video and audio elements.
      */
      function stopMedia(destiny){
          var panel = getSlideOrSection(destiny);

          //stopping HTML5 media elements
          $('video, audio', panel).forEach(function(element){
              if( !element.hasAttribute('data-keepplaying') && typeof element.pause === 'function' ) {
                  element.pause();
              }
          });

          //youtube videos
          $('iframe[src*="youtube.com/embed/"]', panel).forEach(function(element){
              if( /youtube\.com\/embed\//.test(element.getAttribute('src')) && !element.hasAttribute('data-keepplaying')){
                  element.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}','*');
              }
          });
      }

      /**
      * Gets the active slide (or section) for the given section
      */
      function getSlideOrSection(destiny){
          var slide = $(SLIDE_ACTIVE_SEL, destiny);
          if( slide.length ) {
              destiny = slide[0];
          }

          return destiny;
      }

      /**
      * Scrolls to the anchor in the URL when loading the site
      */
      function scrollToAnchor(){
          var anchors =  getAnchorsURL();
          var sectionAnchor = anchors.section;
          var slideAnchor = anchors.slide;

          if(sectionAnchor){  //if theres any #
              if(options.animateAnchor){
                  scrollPageAndSlide(sectionAnchor, slideAnchor);
              }else{
                  silentMoveTo(sectionAnchor, slideAnchor);
              }
          }
      }

      /**
      * Detecting any change on the URL to scroll to the given anchor link
      * (a way to detect back history button as we play with the hashes on the URL)
      */
      function hashChangeHandler(){
          if(!isScrolling && !options.lockAnchors){
              var anchors = getAnchorsURL();
              var sectionAnchor = anchors.section;
              var slideAnchor = anchors.slide;

              //when moving to a slide in the first section for the first time (first time to add an anchor to the URL)
              var isFirstSlideMove =  (typeof lastScrolledDestiny === 'undefined');
              var isFirstScrollMove = (typeof lastScrolledDestiny === 'undefined' && typeof slideAnchor === 'undefined' && !slideMoving);

              if(sectionAnchor && sectionAnchor.length){
                  /*in order to call scrollpage() only once for each destination at a time
                  It is called twice for each scroll otherwise, as in case of using anchorlinks `hashChange`
                  event is fired on every scroll too.*/
                  if ((sectionAnchor && sectionAnchor !== lastScrolledDestiny) && !isFirstSlideMove
                      || isFirstScrollMove
                      || (!slideMoving && lastScrolledSlide != slideAnchor )){

                      scrollPageAndSlide(sectionAnchor, slideAnchor);
                  }
              }
          }
      }

      //gets the URL anchors (section and slide)
      function getAnchorsURL(){
          var section;
          var slide;
          var hash = window.location.hash;

          if(hash.length){
              //getting the anchor link in the URL and deleting the `#`
              var anchorsParts =  hash.replace('#', '').split('/');

              //using / for visual reasons and not as a section/slide separator #2803
              var isFunkyAnchor = hash.indexOf('#/') > -1;

              section = isFunkyAnchor ? '/' + anchorsParts[1] : decodeURIComponent(anchorsParts[0]);

              var slideAnchor = isFunkyAnchor ? anchorsParts[2] : anchorsParts[1];
              if(slideAnchor && slideAnchor.length){
                  slide = decodeURIComponent(slideAnchor);
              }
          }

          return {
              section: section,
              slide: slide
          };
      }

      //Sliding with arrow keys, both, vertical and horizontal
      function keydownHandler(e) {
          clearTimeout(keydownId);

          var activeElement = document.activeElement;
          var keyCode = e.keyCode;

          //tab?
          if(keyCode === 9){
              onTab(e);
          }

          else if(!matches(activeElement, 'textarea') && !matches(activeElement, 'input') && !matches(activeElement, 'select') &&
              activeElement.getAttribute('contentEditable') !== "true" && activeElement.getAttribute('contentEditable') !== '' &&
              options.keyboardScrolling && options.autoScrolling){

              //preventing the scroll with arrow keys & spacebar & Page Up & Down keys
              var keyControls = [40, 38, 32, 33, 34];
              if(keyControls.indexOf(keyCode) > -1){
                  preventDefault(e);
              }

              controlPressed = e.ctrlKey;

              keydownId = setTimeout(function(){
                  onkeydown(e);
              },150);
          }
      }

      function tooltipTextHandler(){
          /*jshint validthis:true */
          trigger(prev(this), 'click');
      }

      //to prevent scrolling while zooming
      function keyUpHandler(e){
          if(isWindowFocused){ //the keyup gets fired on new tab ctrl + t in Firefox
              controlPressed = e.ctrlKey;
          }
      }

      //binding the mousemove when the mouse's middle button is released
      function mouseDownHandler(e){
          //middle button
          if (e.which == 2){
              oldPageY = e.pageY;
              container.addEventListener('mousemove', mouseMoveHandler);
          }
      }

      //unbinding the mousemove when the mouse's middle button is released
      function mouseUpHandler(e){
          //middle button
          if (e.which == 2){
              container.removeEventListener('mousemove', mouseMoveHandler);
          }
      }

      /**
      * Makes sure the tab key will only focus elements within the current section/slide
      * preventing this way from breaking the page.
      * Based on "Modals and keyboard traps"
      * from https://developers.google.com/web/fundamentals/accessibility/focus/using-tabindex
      */
      function onTab(e){
          var isShiftPressed = e.shiftKey;
          var activeElement = document.activeElement;
          var focusableElements = getFocusables(getSlideOrSection($(SECTION_ACTIVE_SEL)[0]));

          function preventAndFocusFirst(e){
              preventDefault(e);
              return focusableElements[0] ? focusableElements[0].focus() : null;
          }

          //outside any section or slide? Let's not hijack the tab!
          if(isFocusOutside(e)){
              return;
          }

          //is there an element with focus?
          if(activeElement){
              if(closest(activeElement, SECTION_ACTIVE_SEL + ',' + SECTION_ACTIVE_SEL + ' ' + SLIDE_ACTIVE_SEL) == null){
                  activeElement = preventAndFocusFirst(e);
              }
          }

          //no element if focused? Let's focus the first one of the section/slide
          else{
              preventAndFocusFirst(e);
          }

          //when reached the first or last focusable element of the section/slide
          //we prevent the tab action to keep it in the last focusable element
          if(!isShiftPressed && activeElement == focusableElements[focusableElements.length - 1] ||
              isShiftPressed && activeElement == focusableElements[0]
          ){
              preventDefault(e);
          }
      }

      /**
      * Gets all the focusable elements inside the passed element.
      */
      function getFocusables(el){
          return [].slice.call($(focusableElementsString, el)).filter(function(item) {
                  return item.getAttribute('tabindex') !== '-1'
                  //are also not hidden elements (or with hidden parents)
                  && item.offsetParent !== null;
          });
      }

      /**
      * Determines whether the focus is outside fullpage.js sections/slides or not.
      */
      function isFocusOutside(e){
          var allFocusables = getFocusables(document);
          var currentFocusIndex = allFocusables.indexOf(document.activeElement);
          var focusDestinationIndex = e.shiftKey ? currentFocusIndex - 1 : currentFocusIndex + 1;
          var focusDestination = allFocusables[focusDestinationIndex];
          var destinationItemSlide = nullOrSlide(closest(focusDestination, SLIDE_SEL));
          var destinationItemSection = nullOrSection(closest(focusDestination, SECTION_SEL));

          return !destinationItemSlide && !destinationItemSection;
      }

      //Scrolling horizontally when clicking on the slider controls.
      function slideArrowHandler(){
          /*jshint validthis:true */
          var section = closest(this, SECTION_SEL);

          /*jshint validthis:true */
          if (hasClass(this, SLIDES_PREV)) {
              if(isScrollAllowed.m.left){
                  moveSlideLeft(section);
              }
          } else {
              if(isScrollAllowed.m.right){
                  moveSlideRight(section);
              }
          }
      }

      //when opening a new tab (ctrl + t), `control` won't be pressed when coming back.
      function blurHandler(){
          isWindowFocused = false;
          controlPressed = false;
      }

      //Scrolls to the section when clicking the navigation bullet
      function sectionBulletHandler(e){
          preventDefault(e);

          /*jshint validthis:true */
          var indexBullet = index(closest(this, SECTION_NAV_SEL + ' li'));
          scrollPage($(SECTION_SEL)[indexBullet]);
      }

      //Scrolls the slider to the given slide destination for the given section
      function slideBulletHandler(e){
          preventDefault(e);

          /*jshint validthis:true */
          var slides = $(SLIDES_WRAPPER_SEL, closest(this, SECTION_SEL))[0];
          var destiny = $(SLIDE_SEL, slides)[index(closest(this, 'li'))];

          landscapeScroll(slides, destiny);
      }

      //Menu item handler when not using anchors or using lockAnchors:true
      function menuItemsHandler(e){
          if($(options.menu)[0] && (options.lockAnchors || !options.anchors.length)){
              preventDefault(e);
              /*jshint validthis:true */
              moveTo(this.getAttribute('data-menuanchor'));
          }
      }

      /**
      * Keydown event
      */
      function onkeydown(e){
          var shiftPressed = e.shiftKey;
          var activeElement = document.activeElement;
          var isMediaFocused = matches(activeElement, 'video') || matches(activeElement, 'audio');

          //do nothing if we can not scroll or we are not using horizotnal key arrows.
          if(!canScroll && [37,39].indexOf(e.keyCode) < 0){
              return;
          }

          switch (e.keyCode) {
              //up
              case 38:
              case 33:
                  if(isScrollAllowed.k.up){
                      moveSectionUp();
                  }
                  break;

              //down
              case 32: //spacebar

                  if(shiftPressed && isScrollAllowed.k.up && !isMediaFocused){
                      moveSectionUp();
                      break;
                  }
              /* falls through */
              case 40:
              case 34:
                  if(isScrollAllowed.k.down){
                      // space bar?
                      if(e.keyCode !== 32 || !isMediaFocused){
                          moveSectionDown();
                      }
                  }
                  break;

              //Home
              case 36:
                  if(isScrollAllowed.k.up){
                      moveTo(1);
                  }
                  break;

              //End
              case 35:
                   if(isScrollAllowed.k.down){
                      moveTo( $(SECTION_SEL).length );
                  }
                  break;

              //left
              case 37:
                  if(isScrollAllowed.k.left){
                      moveSlideLeft();
                  }
                  break;

              //right
              case 39:
                  if(isScrollAllowed.k.right){
                      moveSlideRight();
                  }
                  break;

              default:
                  return; // exit this handler for other keys
          }
      }

      /**
      * Detecting the direction of the mouse movement.
      * Used only for the middle button of the mouse.
      */
      var oldPageY = 0;
      function mouseMoveHandler(e){
          if(!options.autoScrolling){
              return;
          }
          if(canScroll){
              // moving up
              if (e.pageY < oldPageY && isScrollAllowed.m.up){
                  moveSectionUp();
              }

              // moving down
              else if(e.pageY > oldPageY && isScrollAllowed.m.down){
                  moveSectionDown();
              }
          }
          oldPageY = e.pageY;
      }

      /**
      * Scrolls horizontal sliders.
      */
      function landscapeScroll(slides, destiny, direction){
          var section = closest(slides, SECTION_SEL);
          var v = {
              slides: slides,
              destiny: destiny,
              direction: direction,
              destinyPos: {left: destiny.offsetLeft},
              slideIndex: index(destiny),
              section: section,
              sectionIndex: index(section, SECTION_SEL),
              anchorLink: section.getAttribute('data-anchor'),
              slidesNav: $(SLIDES_NAV_SEL, section)[0],
              slideAnchor: getAnchor(destiny),
              prevSlide: $(SLIDE_ACTIVE_SEL, section)[0],
              prevSlideIndex: index($(SLIDE_ACTIVE_SEL, section)[0]),

              //caching the value of isResizing at the momment the function is called
              //because it will be checked later inside a setTimeout and the value might change
              localIsResizing: isResizing
          };
          v.xMovement = getXmovement(v.prevSlideIndex, v.slideIndex);
          v.direction = v.direction ? v.direction : v.xMovement;

          //important!! Only do it when not resizing
          if(!v.localIsResizing){
              //preventing from scrolling to the next/prev section when using scrollHorizontally
              canScroll = false;
          }

          if(options.onSlideLeave){

              //if the site is not just resizing and readjusting the slides
              if(!v.localIsResizing && v.xMovement!=='none'){
                  if(isFunction( options.onSlideLeave )){
                      if( fireCallback('onSlideLeave', v) === false){
                          slideMoving = false;
                          return;
                      }
                  }
              }
          }

          addClass(destiny, ACTIVE);
          removeClass(siblings(destiny), ACTIVE);

          if(!v.localIsResizing){
              stopMedia(v.prevSlide);
              lazyLoad(destiny);
          }

          if(!options.loopHorizontal && options.controlArrows){
              //hidding it for the fist slide, showing for the rest
              toggle($(SLIDES_ARROW_PREV_SEL, section), v.slideIndex!==0);

              //hidding it for the last slide, showing for the rest
              toggle($(SLIDES_ARROW_NEXT_SEL, section), next(destiny) != null);
          }

          //only changing the URL if the slides are in the current section (not for resize re-adjusting)
          if(hasClass(section, ACTIVE) && !v.localIsResizing){
              setState(v.slideIndex, v.slideAnchor, v.anchorLink, v.sectionIndex);
          }

          performHorizontalMove(slides, v, true);
      }


      function afterSlideLoads(v){
          activeSlidesNavigation(v.slidesNav, v.slideIndex);

          //if the site is not just resizing and readjusting the slides
          if(!v.localIsResizing){
              if(isFunction( options.afterSlideLoad )){
                  fireCallback('afterSlideLoad', v);
              }

              //needs to be inside the condition to prevent problems with continuousVertical and scrollHorizontally
              //and to prevent double scroll right after a windows resize
              canScroll = true;

              playMedia(v.destiny);
          }

          //letting them slide again
          slideMoving = false;
      }

      /**
      * Performs the horizontal movement. (CSS3 or jQuery)
      *
      * @param fireCallback {Bool} - determines whether or not to fire the callback
      */
      function performHorizontalMove(slides, v, fireCallback){
          var destinyPos = v.destinyPos;

          if(options.css3){
              var translate3d = 'translate3d(-' + Math.round(destinyPos.left) + 'px, 0px, 0px)';

              FP.test.translate3dH[v.sectionIndex] = translate3d;
              css(addAnimation($(SLIDES_CONTAINER_SEL, slides)), getTransforms(translate3d));

              afterSlideLoadsId = setTimeout(function(){
                  if(fireCallback){
                      afterSlideLoads(v);
                  }
              }, options.scrollingSpeed);
          }else{
              FP.test.left[v.sectionIndex] = Math.round(destinyPos.left);

              scrollTo(slides, Math.round(destinyPos.left), options.scrollingSpeed, function(){
                  if(fireCallback){
                      afterSlideLoads(v);
                  }
              });
          }
      }

      /**
      * Sets the state for the horizontal bullet navigations.
      */
      function activeSlidesNavigation(slidesNav, slideIndex){
          if(options.slidesNavigation && slidesNav != null){
              removeClass($(ACTIVE_SEL, slidesNav), ACTIVE);
              addClass( $('a', $('li', slidesNav)[slideIndex] ), ACTIVE);
          }
      }

      var previousHeight = windowsHeight;

      /*
      * Resize event handler.
      */        
      function resizeHandler(){
          clearTimeout(resizeId);

          //in order to call the functions only when the resize is finished
          //http://stackoverflow.com/questions/4298612/jquery-how-to-call-resize-event-only-once-its-finished-resizing    
          resizeId = setTimeout(function(){

              //issue #3336 
              //(some apps or browsers, like Chrome/Firefox for Mobile take time to report the real height)
              //so we check it 3 times with intervals in that case
              for(var i = 0; i< 4; i++){
                  resizeHandlerId = setTimeout(resizeActions, 200 * i);
              }
          }, 200);
      }

      /**
      * When resizing the site, we adjust the heights of the sections, slimScroll...
      */
      function resizeActions(){

          //checking if it needs to get responsive
          responsive();

          // rebuild immediately on touch devices
          if (isTouchDevice) {
              var activeElement = document.activeElement;

              //if the keyboard is NOT visible
              if (!matches(activeElement, 'textarea') && !matches(activeElement, 'input') && !matches(activeElement, 'select')) {
                  var currentHeight = getWindowHeight();

                  //making sure the change in the viewport size is enough to force a rebuild. (20 % of the window to avoid problems when hidding scroll bars)
                  if( Math.abs(currentHeight - previousHeight) > (20 * Math.max(previousHeight, currentHeight) / 100) ){
                      reBuild(true);
                      previousHeight = currentHeight;
                  }
              }
          }
          else{
              adjustToNewViewport();
          }
      }

      /**
      * Checks if the site needs to get responsive and disables autoScrolling if so.
      * A class `fp-responsive` is added to the plugin's container in case the user wants to use it for his own responsive CSS.
      */
      function responsive(){
          var widthLimit = options.responsive || options.responsiveWidth; //backwards compatiblity
          var heightLimit = options.responsiveHeight;

          //only calculating what we need. Remember its called on the resize event.
          var isBreakingPointWidth = widthLimit && window.innerWidth < widthLimit;
          var isBreakingPointHeight = heightLimit && window.innerHeight < heightLimit;

          if(widthLimit && heightLimit){
              setResponsive(isBreakingPointWidth || isBreakingPointHeight);
          }
          else if(widthLimit){
              setResponsive(isBreakingPointWidth);
          }
          else if(heightLimit){
              setResponsive(isBreakingPointHeight);
          }
      }

      /**
      * Adds transition animations for the given element
      */
      function addAnimation(element){
          var transition = 'all ' + options.scrollingSpeed + 'ms ' + options.easingcss3;

          removeClass(element, NO_TRANSITION);
          return css(element, {
              '-webkit-transition': transition,
              'transition': transition
          });
      }

      /**
      * Remove transition animations for the given element
      */
      function removeAnimation(element){
          return addClass(element, NO_TRANSITION);
      }

      /**
      * Activating the vertical navigation bullets according to the given slide name.
      */
      function activateNavDots(name, sectionIndex){
          if(options.navigation && $(SECTION_NAV_SEL)[0] != null){
                  removeClass($(ACTIVE_SEL, $(SECTION_NAV_SEL)[0]), ACTIVE);
              if(name){
                  addClass( $('a[href="#' + name + '"]', $(SECTION_NAV_SEL)[0]), ACTIVE);
              }else{
                  addClass($('a', $('li', $(SECTION_NAV_SEL)[0])[sectionIndex]), ACTIVE);
              }
          }
      }

      /**
      * Activating the website main menu elements according to the given slide name.
      */
      function activateMenuElement(name){
          $(options.menu).forEach(function(menu) {
              if(options.menu && menu != null){
                  removeClass($(ACTIVE_SEL, menu), ACTIVE);
                  addClass($('[data-menuanchor="'+name+'"]', menu), ACTIVE);
              }
          });
      }

      /**
      * Sets to active the current menu and vertical nav items.
      */
      function activateMenuAndNav(anchor, index){
          activateMenuElement(anchor);
          activateNavDots(anchor, index);
      }

      /**
      * Retuns `up` or `down` depending on the scrolling movement to reach its destination
      * from the current section.
      */
      function getYmovement(destiny){
          var fromIndex = index($(SECTION_ACTIVE_SEL)[0], SECTION_SEL);
          var toIndex = index(destiny, SECTION_SEL);
          if( fromIndex == toIndex){
              return 'none';
          }
          if(fromIndex > toIndex){
              return 'up';
          }
          return 'down';
      }

      /**
      * Retuns `right` or `left` depending on the scrolling movement to reach its destination
      * from the current slide.
      */
      function getXmovement(fromIndex, toIndex){
          if( fromIndex == toIndex){
              return 'none';
          }
          if(fromIndex > toIndex){
              return 'left';
          }
          return 'right';
      }

      function addTableClass(element){
          //In case we are styling for the 2nd time as in with reponsiveSlides
          if(!hasClass(element, TABLE)){
              var wrapper = document.createElement('div');
              wrapper.className = TABLE_CELL;
              wrapper.style.height = getTableHeight(element) + 'px';

              addClass(element, TABLE);
              wrapInner(element, wrapper);
          }
      }

      function getTableHeight(element){
          var sectionHeight = windowsHeight;

          if(options.paddingTop || options.paddingBottom){
              var section = element;
              if(!hasClass(section, SECTION)){
                  section = closest(element, SECTION_SEL);
              }

              var paddings = parseInt(getComputedStyle(section)['padding-top']) + parseInt(getComputedStyle(section)['padding-bottom']);
              sectionHeight = (windowsHeight - paddings);
          }

          return sectionHeight;
      }

      /**
      * Adds a css3 transform property to the container class with or without animation depending on the animated param.
      */
      function transformContainer(translate3d, animated){
          if(animated){
              addAnimation(container);
          }else{
              removeAnimation(container);
          }

          css(container, getTransforms(translate3d));
          FP.test.translate3d = translate3d;

          //syncronously removing the class after the animation has been applied.
          setTimeout(function(){
              removeClass(container, NO_TRANSITION);
          },10);
      }

      /**
      * Gets a section by its anchor / index
      */
      function getSectionByAnchor(sectionAnchor){
          var section = $(SECTION_SEL + '[data-anchor="'+sectionAnchor+'"]', container)[0];
          if(!section){
              var sectionIndex = typeof sectionAnchor !== 'undefined' ? sectionAnchor -1 : 0;
              section = $(SECTION_SEL)[sectionIndex];
          }

          return section;
      }

      /**
      * Gets a slide inside a given section by its anchor / index
      */
      function getSlideByAnchor(slideAnchor, section){
          var slide = $(SLIDE_SEL + '[data-anchor="'+slideAnchor+'"]', section)[0];
          if(slide == null){
              slideAnchor = typeof slideAnchor !== 'undefined' ? slideAnchor : 0;
              slide = $(SLIDE_SEL, section)[slideAnchor];
          }

          return slide;
      }

      /**
      * Scrolls to the given section and slide anchors
      */
      function scrollPageAndSlide(sectionAnchor, slideAnchor){
          var section = getSectionByAnchor(sectionAnchor);

          //do nothing if there's no section with the given anchor name
          if(section == null) return;

          var slide = getSlideByAnchor(slideAnchor, section);

          //we need to scroll to the section and then to the slide
          if (getAnchor(section) !== lastScrolledDestiny && !hasClass(section, ACTIVE)){
              scrollPage(section, function(){
                  scrollSlider(slide);
              });
          }
          //if we were already in the section
          else{
              scrollSlider(slide);
          }
      }

      /**
      * Scrolls the slider to the given slide destination for the given section
      */
      function scrollSlider(slide){
          if(slide != null){
              landscapeScroll(closest(slide, SLIDES_WRAPPER_SEL), slide);
          }
      }

      /**
      * Creates a landscape navigation bar with dots for horizontal sliders.
      */
      function addSlidesNavigation(section, numSlides){
          appendTo(createElementFromHTML('<div class="' + SLIDES_NAV + '"><ul></ul></div>'), section);
          var nav = $(SLIDES_NAV_SEL, section)[0];

          //top or bottom
          addClass(nav, 'fp-' + options.slidesNavPosition);

          for(var i=0; i< numSlides; i++){
              appendTo(createElementFromHTML('<li><a href="#"><span class="fp-sr-only">'+ getBulletLinkName(i, 'Slide') +'</span><span></span></a></li>'), $('ul', nav)[0] );
          }

          //centering it
          css(nav, {'margin-left': '-' + (nav.innerWidth/2) + 'px'});

          addClass($('a', $('li', nav)[0] ), ACTIVE);
      }


      /**
      * Sets the state of the website depending on the active section/slide.
      * It changes the URL hash when needed and updates the body class.
      */
      function setState(slideIndex, slideAnchor, anchorLink, sectionIndex){
          var sectionHash = '';

          if(options.anchors.length && !options.lockAnchors){

              //isn't it the first slide?
              if(slideIndex){
                  if(anchorLink != null){
                      sectionHash = anchorLink;
                  }

                  //slide without anchor link? We take the index instead.
                  if(slideAnchor == null){
                      slideAnchor = slideIndex;
                  }

                  lastScrolledSlide = slideAnchor;
                  setUrlHash(sectionHash + '/' + slideAnchor);

              //first slide won't have slide anchor, just the section one
              }else if(slideIndex != null){
                  lastScrolledSlide = slideAnchor;
                  setUrlHash(anchorLink);
              }

              //section without slides
              else{
                  setUrlHash(anchorLink);
              }
          }

          setBodyClass();
      }

      /**
      * Sets the URL hash.
      */
      function setUrlHash(url){
          if(options.recordHistory){
              location.hash = url;
          }else{
              //Mobile Chrome doesn't work the normal way, so... lets use HTML5 for phones :)
              if(isTouchDevice || isTouch){
                  window.history.replaceState(undefined, undefined, '#' + url);
              }else{
                  var baseUrl = window.location.href.split('#')[0];
                  window.location.replace( baseUrl + '#' + url );
              }
          }
      }

      /**
      * Gets the anchor for the given slide / section. Its index will be used if there's none.
      */
      function getAnchor(element){
          if(!element){
              return null;
          }
          var anchor = element.getAttribute('data-anchor');
          var elementIndex = index(element);

          //Slide without anchor link? We take the index instead.
          if(anchor == null){
              anchor = elementIndex;
          }

          return anchor;
      }

      /**
      * Sets a class for the body of the page depending on the active section / slide
      */
      function setBodyClass(){
          var section = $(SECTION_ACTIVE_SEL)[0];
          var slide = $(SLIDE_ACTIVE_SEL, section)[0];

          var sectionAnchor = getAnchor(section);
          var slideAnchor = getAnchor(slide);

          var text = String(sectionAnchor);

          if(slide){
              text = text + '-' + slideAnchor;
          }

          //changing slash for dash to make it a valid CSS style
          text = text.replace('/', '-').replace('#','');

          //removing previous anchor classes
          var classRe = new RegExp('\\b\\s?' + VIEWING_PREFIX + '-[^\\s]+\\b', "g");
          $body.className = $body.className.replace(classRe, '');

          //adding the current anchor
          addClass($body, VIEWING_PREFIX + '-' + text);
      }

      /**
      * Checks for translate3d support
      * @return boolean
      * http://stackoverflow.com/questions/5661671/detecting-transform-translate3d-support
      */
      function support3d() {
          var el = document.createElement('p'),
              has3d,
              transforms = {
                  'webkitTransform':'-webkit-transform',
                  'OTransform':'-o-transform',
                  'msTransform':'-ms-transform',
                  'MozTransform':'-moz-transform',
                  'transform':'transform'
              };

          //preventing the style p:empty{display: none;} from returning the wrong result
          el.style.display = 'block';

          // Add it to the body to get the computed style.
          document.body.insertBefore(el, null);

          for (var t in transforms) {
              if (el.style[t] !== undefined) {
                  el.style[t] = 'translate3d(1px,1px,1px)';
                  has3d = window.getComputedStyle(el).getPropertyValue(transforms[t]);
              }
          }

          document.body.removeChild(el);

          return (has3d !== undefined && has3d.length > 0 && has3d !== 'none');
      }

      /**
      * Removes the auto scrolling action fired by the mouse wheel and trackpad.
      * After this function is called, the mousewheel and trackpad movements won't scroll through sections.
      */
      function removeMouseWheelHandler(){
          if (document.addEventListener) {
              document.removeEventListener('mousewheel', MouseWheelHandler, false); //IE9, Chrome, Safari, Oper
              document.removeEventListener('wheel', MouseWheelHandler, false); //Firefox
              document.removeEventListener('MozMousePixelScroll', MouseWheelHandler, false); //old Firefox
          } else {
              document.detachEvent('onmousewheel', MouseWheelHandler); //IE 6/7/8
          }
      }

      /**
      * Adds the auto scrolling action for the mouse wheel and trackpad.
      * After this function is called, the mousewheel and trackpad movements will scroll through sections
      * https://developer.mozilla.org/en-US/docs/Web/Events/wheel
      */
      function addMouseWheelHandler(){
          var prefix = '';
          var _addEventListener;

          if (window.addEventListener){
              _addEventListener = "addEventListener";
          }else{
              _addEventListener = "attachEvent";
              prefix = 'on';
          }

          // detect available wheel event
          var support = 'onwheel' in document.createElement('div') ? 'wheel' : // Modern browsers support "wheel"
                    document.onmousewheel !== undefined ? 'mousewheel' : // Webkit and IE support at least "mousewheel"
                    'DOMMouseScroll'; // let's assume that remaining browsers are older Firefox
          var passiveEvent = g_supportsPassive ? {passive: false }: false;

          if(support == 'DOMMouseScroll'){
              document[ _addEventListener ](prefix + 'MozMousePixelScroll', MouseWheelHandler, passiveEvent);
          }

          //handle MozMousePixelScroll in older Firefox
          else{
              document[ _addEventListener ](prefix + support, MouseWheelHandler, passiveEvent);
          }
      }

      /**
      * Binding the mousemove when the mouse's middle button is pressed
      */
      function addMiddleWheelHandler(){
          container.addEventListener('mousedown', mouseDownHandler);
          container.addEventListener('mouseup', mouseUpHandler);
      }

      /**
      * Unbinding the mousemove when the mouse's middle button is released
      */
      function removeMiddleWheelHandler(){
          container.removeEventListener('mousedown', mouseDownHandler);
          container.removeEventListener('mouseup', mouseUpHandler);
      }

      /**
      * Adds the possibility to auto scroll through sections on touch devices.
      */
      function addTouchHandler(){
          if(isTouchDevice || isTouch){
              if(options.autoScrolling){
                  $body.removeEventListener(events.touchmove, preventBouncing, {passive: false});
                  $body.addEventListener(events.touchmove, preventBouncing, {passive: false});
              }

              var touchWrapper = options.touchWrapper;
              touchWrapper.removeEventListener(events.touchstart, touchStartHandler);
              touchWrapper.removeEventListener(events.touchmove, touchMoveHandler, {passive: false});

              touchWrapper.addEventListener(events.touchstart, touchStartHandler);
              touchWrapper.addEventListener(events.touchmove, touchMoveHandler, {passive: false});
          }
      }

      /**
      * Removes the auto scrolling for touch devices.
      */
      function removeTouchHandler(){
          if(isTouchDevice || isTouch){
              // normalScrollElements requires it off #2691
              if(options.autoScrolling){
                  $body.removeEventListener(events.touchmove, touchMoveHandler, {passive: false});
                  $body.removeEventListener(events.touchmove, preventBouncing, {passive: false});
              }

              var touchWrapper = options.touchWrapper;
              touchWrapper.removeEventListener(events.touchstart, touchStartHandler);
              touchWrapper.removeEventListener(events.touchmove, touchMoveHandler, {passive: false});
          }
      }

      /*
      * Returns and object with Microsoft pointers (for IE<11 and for IE >= 11)
      * http://msdn.microsoft.com/en-us/library/ie/dn304886(v=vs.85).aspx
      */
      function getMSPointer(){
          var pointer;

          //IE >= 11 & rest of browsers
          if(window.PointerEvent){
              pointer = { down: 'pointerdown', move: 'pointermove'};
          }

          //IE < 11
          else{
              pointer = { down: 'MSPointerDown', move: 'MSPointerMove'};
          }

          return pointer;
      }

      /**
      * Gets the pageX and pageY properties depending on the browser.
      * https://github.com/alvarotrigo/fullPage.js/issues/194#issuecomment-34069854
      */
      function getEventsPage(e){
          var events = [];

          events.y = (typeof e.pageY !== 'undefined' && (e.pageY || e.pageX) ? e.pageY : e.touches[0].pageY);
          events.x = (typeof e.pageX !== 'undefined' && (e.pageY || e.pageX) ? e.pageX : e.touches[0].pageX);

          //in touch devices with scrollBar:true, e.pageY is detected, but we have to deal with touch events. #1008
          if(isTouch && isReallyTouch(e) && options.scrollBar && typeof e.touches !== 'undefined'){
              events.y = e.touches[0].pageY;
              events.x = e.touches[0].pageX;
          }

          return events;
      }

      /**
      * Slides silently (with no animation) the active slider to the given slide.
      * @param noCallback {bool} true or defined -> no callbacks
      */
      function silentLandscapeScroll(activeSlide, noCallbacks){
          setScrollingSpeed(0, 'internal');

          if(typeof noCallbacks !== 'undefined'){
              //preventing firing callbacks afterSlideLoad etc.
              isResizing = true;
          }

          landscapeScroll(closest(activeSlide, SLIDES_WRAPPER_SEL), activeSlide);

          if(typeof noCallbacks !== 'undefined'){
              isResizing = false;
          }

          setScrollingSpeed(originals.scrollingSpeed, 'internal');
      }

      /**
      * Scrolls silently (with no animation) the page to the given Y position.
      */
      function silentScroll(top){
          // The first section can have a negative value in iOS 10. Not quite sure why: -0.0142822265625
          // that's why we round it to 0.
          var roundedTop = Math.round(top);

          if (options.css3 && options.autoScrolling && !options.scrollBar){
              var translate3d = 'translate3d(0px, -' + roundedTop + 'px, 0px)';
              transformContainer(translate3d, false);
          }
          else if(options.autoScrolling && !options.scrollBar){
              css(container, {'top': -roundedTop + 'px'});
              FP.test.top = -roundedTop + 'px';
          }
          else{
              var scrollSettings = getScrollSettings(roundedTop);
              setScrolling(scrollSettings.element, scrollSettings.options);
          }
      }

      /**
      * Returns the cross-browser transform string.
      */
      function getTransforms(translate3d){
          return {
              '-webkit-transform': translate3d,
              '-moz-transform': translate3d,
              '-ms-transform':translate3d,
              'transform': translate3d
          };
      }

      /**
      * Allowing or disallowing the mouse/swipe scroll in a given direction. (not for keyboard)
      * @type  m (mouse) or k (keyboard)
      */
      function setIsScrollAllowed(value, direction, type){
          //up, down, left, right
          if(direction !== 'all'){
              isScrollAllowed[type][direction] = value;
          }

          //all directions?
          else{
              Object.keys(isScrollAllowed[type]).forEach(function(key){
                  isScrollAllowed[type][key] = value;
              });
          }
      }

      /*
      * Destroys fullpage.js plugin events and optinally its html markup and styles
      */
      function destroy(all){
          setAutoScrolling(false, 'internal');
          setAllowScrolling(true);
          setMouseHijack(false);
          setKeyboardScrolling(false);
          addClass(container, DESTROYED);

          [
              afterSlideLoadsId, 
              afterSectionLoadsId,
              resizeId,
              scrollId,
              scrollId2,
              g_doubleCheckHeightId,
              resizeHandlerId
          ].forEach(function(timeoutId){
              clearTimeout(timeoutId);
          });

          window.removeEventListener('scroll', scrollHandler);
          window.removeEventListener('hashchange', hashChangeHandler);
          window.removeEventListener('resize', resizeHandler);

          document.removeEventListener('keydown', keydownHandler);
          document.removeEventListener('keyup', keyUpHandler);

          ['click', 'touchstart'].forEach(function(eventName){
              document.removeEventListener(eventName, delegatedEvents);
          });

          ['mouseenter', 'touchstart', 'mouseleave', 'touchend'].forEach(function(eventName){
              document.removeEventListener(eventName, onMouseEnterOrLeave, true); //true is required!
          });

          //lets make a mess!
          if(all){
              destroyStructure();
          }
      }

      /*
      * Removes inline styles added by fullpage.js
      */
      function destroyStructure(){
          //reseting the `top` or `translate` properties to 0
          silentScroll(0);

          //loading all the lazy load content
          $('img[data-src], source[data-src], audio[data-src], iframe[data-src]', container).forEach(function(item){
              setSrc(item, 'src');
          });

          $('img[data-srcset]').forEach(function(item){
              setSrc(item, 'srcset');
          });

          remove($(SECTION_NAV_SEL + ', ' + SLIDES_NAV_SEL +  ', ' + SLIDES_ARROW_SEL));

          //removing inline styles
          css($(SECTION_SEL), {
              'height': '',
              'background-color' : '',
              'padding': ''
          });

          css($(SLIDE_SEL), {
              'width': ''
          });

          css(container, {
              'height': '',
              'position': '',
              '-ms-touch-action': '',
              'touch-action': ''
          });

          css($htmlBody, {
              'overflow': '',
              'height': ''
          });

          // remove .fp-enabled class
          removeClass($html, ENABLED);

          // remove .fp-responsive class
          removeClass($body, RESPONSIVE);

          // remove all of the .fp-viewing- classes
          $body.className.split(/\s+/).forEach(function (className) {
              if (className.indexOf(VIEWING_PREFIX) === 0) {
                  removeClass($body, className);
              }
          });

          //removing added classes
          $(SECTION_SEL + ', ' + SLIDE_SEL).forEach(function(item){
              if(options.scrollOverflowHandler && options.scrollOverflow){
                  options.scrollOverflowHandler.remove(item);
              }
              removeClass(item, TABLE + ' ' + ACTIVE + ' ' + COMPLETELY);
              var previousStyles = item.getAttribute('data-fp-styles');
              if(previousStyles){
                  item.setAttribute('style', item.getAttribute('data-fp-styles'));
              }

              //removing anchors if they were not set using the HTML markup
              if(hasClass(item, SECTION) && !g_initialAnchorsInDom){
                  item.removeAttribute('data-anchor');
              }
          });

          //removing the applied transition from the fullpage wrapper
          removeAnimation(container);

          //Unwrapping content
          [TABLE_CELL_SEL, SLIDES_CONTAINER_SEL,SLIDES_WRAPPER_SEL].forEach(function(selector){
              $(selector, container).forEach(function(item){
                  //unwrap not being use in case there's no child element inside and its just text
                  unwrap(item);
              });
          });

          //removing the applied transition from the fullpage wrapper
          css(container, {
              '-webkit-transition': 'none',
              'transition': 'none'
          });

          //scrolling the page to the top with no animation
          window.scrollTo(0, 0);

          //removing selectors
          var usedSelectors = [SECTION, SLIDE, SLIDES_CONTAINER];
          usedSelectors.forEach(function(item){
              removeClass($('.' + item), item);
          });
      }

      /*
      * Sets the state for a variable with multiple states (original, and temporal)
      * Some variables such as `autoScrolling` or `recordHistory` might change automatically its state when using `responsive` or `autoScrolling:false`.
      * This function is used to keep track of both states, the original and the temporal one.
      * If type is not 'internal', then we assume the user is globally changing the variable.
      */
      function setVariableState(variable, value, type){
          options[variable] = value;
          if(type !== 'internal'){
              originals[variable] = value;
          }
      }

      /**
      * Displays warnings
      */
      function displayWarnings(){
          var l = options['li' + 'c' + 'enseK' + 'e' + 'y'];
          var msgStyle = 'font-size: 15px;background:yellow;';

          if(!isOK){
              showError('error', 'Fullpage.js version 3 has changed its license to GPLv3 and it requires a `licenseKey` option. Read about it here:');
              showError('error', 'https://github.com/alvarotrigo/fullPage.js#options.');
          }
          else if(l && l.length < 20){
              console.warn('%c This website was made using fullPage.js slider. More info on the following website:', msgStyle);
              console.warn('%c https://alvarotrigo.com/fullPage/', msgStyle);
          }

          if(hasClass($html, ENABLED)){
              showError('error', 'Fullpage.js can only be initialized once and you are doing it multiple times!');
              return;
          }

          // Disable mutually exclusive settings
          if (options.continuousVertical &&
              (options.loopTop || options.loopBottom)) {
              options.continuousVertical = false;
              showError('warn', 'Option `loopTop/loopBottom` is mutually exclusive with `continuousVertical`; `continuousVertical` disabled');
          }

          if(options.scrollOverflow &&
             (options.scrollBar || !options.autoScrolling)){
              showError('warn', 'Options scrollBar:true and autoScrolling:false are mutually exclusive with scrollOverflow:true. Sections with scrollOverflow might not work well in Firefox');
          }

          if(options.continuousVertical && (options.scrollBar || !options.autoScrolling)){
              options.continuousVertical = false;
              showError('warn', 'Scroll bars (`scrollBar:true` or `autoScrolling:false`) are mutually exclusive with `continuousVertical`; `continuousVertical` disabled');
          }

          if(options.scrollOverflow && options.scrollOverflowHandler == null){
              options.scrollOverflow = false;
              showError('error', 'The option `scrollOverflow:true` requires the file `scrolloverflow.min.js`. Please include it before fullPage.js.');
          }

          //using extensions? Wrong file!
          extensions.forEach(function(extension){
              //is the option set to true?
              if(options[extension]){
                  showError('warn', 'fullpage.js extensions require fullpage.extensions.min.js file instead of the usual fullpage.js. Requested: '+ extension);
              }
          });

          //anchors can not have the same value as any element ID or NAME
          options.anchors.forEach(function(name){

              //case insensitive selectors (http://stackoverflow.com/a/19465187/1081396)
              var nameAttr = [].slice.call($('[name]')).filter(function(item) {
                  return item.getAttribute('name') && item.getAttribute('name').toLowerCase() == name.toLowerCase();
              });

              var idAttr = [].slice.call($('[id]')).filter(function(item) {
                  return item.getAttribute('id') && item.getAttribute('id').toLowerCase() == name.toLowerCase();
              });

              if(idAttr.length || nameAttr.length ){
                  showError('error', 'data-anchor tags can not have the same value as any `id` element on the site (or `name` element for IE).');
                  var propertyName = idAttr.length ? 'id' : 'name';

                  if(idAttr.length || nameAttr.length){
                      showError('error', '"' + name + '" is is being used by another element `'+ propertyName +'` property');
                  }
              }
          });
      }

      /**
      * Getting the position of the element to scroll when using jQuery animations
      */
      function getScrolledPosition(element){
          var position;

          //is not the window element and is a slide?
          if(element.self != window && hasClass(element, SLIDES_WRAPPER)){
              position = element.scrollLeft;
          }
          else if(!options.autoScrolling  || options.scrollBar){
              position = getScrollTop();
          }
          else{
              position = element.offsetTop;
          }

          //gets the top property of the wrapper
          return position;
      }

      /**
      * Simulates the animated scrollTop of jQuery. Used when css3:false or scrollBar:true or autoScrolling:false
      * http://stackoverflow.com/a/16136789/1081396
      */
      function scrollTo(element, to, duration, callback) {
          var start = getScrolledPosition(element);
          var change = to - start;
          var currentTime = 0;
          var increment = 20;
          activeAnimation = true;

          var animateScroll = function(){
              if(activeAnimation){ //in order to stope it from other function whenever we want
                  var val = to;

                  currentTime += increment;

                  if(duration){
                      val = window.fp_easings[options.easing](currentTime, start, change, duration);
                  }

                  setScrolling(element, val);

                  if(currentTime < duration) {
                      setTimeout(animateScroll, increment);
                  }else if(typeof callback !== 'undefined'){
                      callback();
                  }
              }else if (currentTime < duration){
                  callback();
              }
          };

          animateScroll();
      }

      /**
      * Scrolls the page / slider the given number of pixels.
      * It will do it one or another way dependiong on the library's config.
      */
      function setScrolling(element, val){
          if(!options.autoScrolling || options.scrollBar || (element.self != window && hasClass(element, SLIDES_WRAPPER))){

              //scrolling horizontally through the slides?
              if(element.self != window  && hasClass(element, SLIDES_WRAPPER)){
                  element.scrollLeft = val;
              }
              //vertical scroll
              else{
                  element.scrollTo(0, val);
              }
          }else{
               element.style.top = val + 'px';
          }
      }

      /**
      * Gets the active slide.
      */
      function getActiveSlide(){
          var activeSlide = $(SLIDE_ACTIVE_SEL, $(SECTION_ACTIVE_SEL)[0])[0];
          return nullOrSlide(activeSlide);
      }

      /**
      * Gets the active section.
      */
      function getActiveSection(){
          return new Section($(SECTION_ACTIVE_SEL)[0]);
      }

      /**
      * Item. Slide or Section objects share the same properties.
      */
      function Item(el, selector){
          this.anchor = el.getAttribute('data-anchor');
          this.item = el;
          this.index = index(el, selector);
          this.isLast = this.index === el.parentElement.querySelectorAll(selector).length -1;
          this.isFirst = !this.index;
      }

      /**
      * Section object
      */
      function Section(el){
          Item.call(this, el, SECTION_SEL);
      }

      /**
      * Slide object
      */
      function Slide(el){
          Item.call(this, el, SLIDE_SEL);
      }

      return FP;
  } //end of $.fn.fullpage

  //utils
  /**
  * Shows a message in the console of the given type.
  */
  function showError(type, text){
      window.console && window.console[type] && window.console[type]('fullPage: ' + text);
  }

  /**
  * Equivalent or jQuery function $().
  */
  function $(selector, context){
      context = arguments.length > 1 ? context : document;
      return context ? context.querySelectorAll(selector) : null;
  }

  /**
  * Extends a given Object properties and its childs.
  */
  function deepExtend(out) {
      out = out || {};
      for (var i = 1, len = arguments.length; i < len; ++i){
          var obj = arguments[i];

          if(!obj){
            continue;
          }

          for(var key in obj){
            if (!obj.hasOwnProperty(key)){
              continue;
            }

            // based on https://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
            if (Object.prototype.toString.call(obj[key]) === '[object Object]'){
              out[key] = deepExtend(out[key], obj[key]);
              continue;
            }

            out[key] = obj[key];
          }
      }
      return out;
  }

  /**
  * Checks if the passed element contains the passed class.
  */
  function hasClass(el, className){
      if(el == null){
          return false;
      }
      if (el.classList){
          return el.classList.contains(className);
      }
      return new RegExp('(^| )' + className + '( |$)', 'gi').test(el.className);
  }

  /**
  * Gets the window height. Crossbrowser.
  */
  function getWindowHeight(){
      return 'innerHeight' in window ? window.innerHeight : document.documentElement.offsetHeight;
  }

  /**
  * Gets the window width.
  */
  function getWindowWidth(){
      return window.innerWidth;
  }

  /**
  * Set's the CSS properties for the passed item/s.
  * @param {NodeList|HTMLElement} items
  * @param {Object} props css properties and values.
  */
  function css(items, props) {
      items = getList(items);

      var key;
      for (key in props) {
          if (props.hasOwnProperty(key)) {
              if (key !== null) {
                  for (var i = 0; i < items.length; i++) {
                      var item = items[i];
                      item.style[key] = props[key];
                  }
              }
          }
      }

      return items;
  }

  /**
  * Generic function to get the previous or next element.
  */
  function until(item, selector, fn){
      var sibling = item[fn];
      while(sibling && !matches(sibling, selector)){
          sibling = sibling[fn];
      }

      return sibling;
  }

  /**
  * Gets the previous element to the passed element that matches the passed selector.
  */
  function prevUntil(item, selector){
      return until(item, selector, 'previousElementSibling');
  }

  /**
  * Gets the next element to the passed element that matches the passed selector.
  */
  function nextUntil(item, selector){
      return until(item, selector, 'nextElementSibling');
  }

  /**
  * Gets the previous element to the passed element.
  */
  function prev(item){
      return item.previousElementSibling;
  }

  /**
  * Gets the next element to the passed element.
  */
  function next(item){
      return item.nextElementSibling;
  }

  /**
  * Gets the last element from the passed list of elements.
  */
  function last(item){
      return item[item.length-1];
  }

  /**
  * Gets index from the passed element.
  * @param {String} selector is optional.
  */
  function index(item, selector) {
      item = isArrayOrList(item) ? item[0] : item;
      var children = selector != null? $(selector, item.parentNode) : item.parentNode.childNodes;
      var num = 0;
      for (var i=0; i<children.length; i++) {
           if (children[i] == item) return num;
           if (children[i].nodeType==1) num++;
      }
      return -1;
  }

  /**
  * Gets an iterable element for the passed element/s
  */
  function getList(item){
      return !isArrayOrList(item) ? [item] : item;
  }

  /**
  * Adds the display=none property for the passed element/s
  */
  function hide(el){
      el = getList(el);

      for(var i = 0; i<el.length; i++){
          el[i].style.display = 'none';
      }
      return el;
  }

  /**
  * Adds the display=block property for the passed element/s
  */
  function show(el){
      el = getList(el);

      for(var i = 0; i<el.length; i++){
          el[i].style.display = 'block';
      }
      return el;
  }

  /**
  * Checks if the passed element is an iterable element or not
  */
  function isArrayOrList(el){
      return Object.prototype.toString.call( el ) === '[object Array]' ||
          Object.prototype.toString.call( el ) === '[object NodeList]';
  }

  /**
  * Adds the passed class to the passed element/s
  */
  function addClass(el, className) {
      el = getList(el);

      for(var i = 0; i<el.length; i++){
          var item = el[i];
          if (item.classList){
              item.classList.add(className);
          }
          else{
            item.className += ' ' + className;
          }
      }
      return el;
  }

  /**
  * Removes the passed class to the passed element/s
  * @param {String} `className` can be multiple classnames separated by whitespace
  */
  function removeClass(el, className){
      el = getList(el);

      var classNames = className.split(' ');

      for(var a = 0; a<classNames.length; a++){
          className = classNames[a];
          for(var i = 0; i<el.length; i++){
              var item = el[i];
              if (item.classList){
                  item.classList.remove(className);
              }
              else{
                  item.className = item.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
              }
          }
      }
      return el;
  }

  /**
  * Appends the given element ot the given parent.
  */
  function appendTo(el, parent){
      parent.appendChild(el);
  }

  /**
  Usage:

  var wrapper = document.createElement('div');
  wrapper.className = 'fp-slides';
  wrap($('.slide'), wrapper);

  https://jsfiddle.net/qwzc7oy3/15/ (vanilla)
  https://jsfiddle.net/oya6ndka/1/ (jquery equivalent)
  */
  function wrap(toWrap, wrapper, isWrapAll) {
      var newParent;
      wrapper = wrapper || document.createElement('div');
      for(var i = 0; i < toWrap.length; i++){
          var item = toWrap[i];
          if(isWrapAll && !i || !isWrapAll){
              newParent = wrapper.cloneNode(true);
              item.parentNode.insertBefore(newParent, item);
          }
          newParent.appendChild(item);
      }
      return toWrap;
  }

  /**
  Usage:
  var wrapper = document.createElement('div');
  wrapper.className = 'fp-slides';
  wrap($('.slide'), wrapper);

  https://jsfiddle.net/qwzc7oy3/27/ (vanilla)
  https://jsfiddle.net/oya6ndka/4/ (jquery equivalent)
  */
  function wrapAll(toWrap, wrapper) {
      wrap(toWrap, wrapper, true);
  }

  /**
  * Usage:
  * wrapInner(document.querySelector('#pepe'), '<div class="test">afdas</div>');
  * wrapInner(document.querySelector('#pepe'), element);
  *
  * https://jsfiddle.net/zexxz0tw/6/
  *
  * https://stackoverflow.com/a/21817590/1081396
  */
  function wrapInner(parent, wrapper) {
      if (typeof wrapper === "string"){
          wrapper = createElementFromHTML(wrapper);
      }

      parent.appendChild(wrapper);

      while(parent.firstChild !== wrapper){
          wrapper.appendChild(parent.firstChild);
     }
  }

  /**
  * Usage:
  * unwrap(document.querySelector('#pepe'));
  * unwrap(element);
  *
  * https://jsfiddle.net/szjt0hxq/1/
  *
  */
  function unwrap(wrapper) {
      var wrapperContent = document.createDocumentFragment();
      while (wrapper.firstChild) {
          wrapperContent.appendChild(wrapper.firstChild);
      }

      wrapper.parentNode.replaceChild(wrapperContent, wrapper);
  }

  /**
  * http://stackoverflow.com/questions/22100853/dom-pure-javascript-solution-to-jquery-closest-implementation
  * Returns the element or `false` if there's none
  */
  function closest(el, selector) {
      if(el && el.nodeType === 1){
          if(matches(el, selector)){
              return el;
          }
          return closest(el.parentNode, selector);
      }
      return null;
  }

  /**
  * Places one element (rel) after another one or group of them (reference).
  * @param {HTMLElement} reference
  * @param {HTMLElement|NodeList|String} el
  * https://jsfiddle.net/9s97hhzv/1/
  */
  function after(reference, el) {
      insertBefore(reference, reference.nextSibling, el);
  }

  /**
  * Places one element (rel) before another one or group of them (reference).
  * @param {HTMLElement} reference
  * @param {HTMLElement|NodeList|String} el
  * https://jsfiddle.net/9s97hhzv/1/
  */
  function before(reference, el) {
      insertBefore(reference, reference, el);
  }

  /**
  * Based in https://stackoverflow.com/a/19316024/1081396
  * and https://stackoverflow.com/a/4793630/1081396
  */
  function insertBefore(reference, beforeElement, el){
      if(!isArrayOrList(el)){
          if(typeof el == 'string'){
              el = createElementFromHTML(el);
          }
          el = [el];
      }

      for(var i = 0; i<el.length; i++){
          reference.parentNode.insertBefore(el[i], beforeElement);
      }
  }

  //http://stackoverflow.com/questions/3464876/javascript-get-window-x-y-position-for-scroll
  function getScrollTop(){
      var doc = document.documentElement;
      return (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
  }

  /**
  * Gets the siblings of the passed element
  */
  function siblings(el){
      return Array.prototype.filter.call(el.parentNode.children, function(child){
        return child !== el;
      });
  }

  //for IE 9 ?
  function preventDefault(event){
      if(event.preventDefault){
          event.preventDefault();
      }
      else{
          event.returnValue = false;
      }
  }

  /**
  * Determines whether the passed item is of function type.
  */
  function isFunction(item) {
    if (typeof item === 'function') {
      return true;
    }
    var type = Object.prototype.toString(item);
    return type === '[object Function]' || type === '[object GeneratorFunction]';
  }

  /**
  * Trigger custom events
  */
  function trigger(el, eventName, data){
      var event;
      data = typeof data === 'undefined' ? {} : data;

      // Native
      if(typeof window.CustomEvent === "function" ){
          event = new CustomEvent(eventName, {detail: data});
      }
      else{
          event = document.createEvent('CustomEvent');
          event.initCustomEvent(eventName, true, true, data);
      }

      el.dispatchEvent(event);
  }

  /**
  * Polyfill of .matches()
  */
  function matches(el, selector) {
      return (el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector).call(el, selector);
  }

  /**
  * Toggles the visibility of the passed element el.
  */
  function toggle(el, value){
      if(typeof value === "boolean"){
          for(var i = 0; i<el.length; i++){
              el[i].style.display = value ? 'block' : 'none';
          }
      }
      //we don't use it in other way, so no else :)

      return el;
  }

  /**
  * Creates a HTMLElement from the passed HTML string.
  * https://stackoverflow.com/a/494348/1081396
  */
  function createElementFromHTML(htmlString) {
      var div = document.createElement('div');
      div.innerHTML = htmlString.trim();

      // Change this to div.childNodes to support multiple top-level nodes
      return div.firstChild;
  }

  /**
  * Removes the passed item/s from the DOM.
  */
  function remove(items){
      items = getList(items);
      for(var i = 0; i<items.length; i++){
          var item = items[i];
          if(item && item.parentElement) {
              item.parentNode.removeChild(item);
          }
      }
  }

  /**
  * Filters an array by the passed filter funtion.
  */
  function filter(el, filterFn){
      Array.prototype.filter.call(el, filterFn);
  }

  //https://jsfiddle.net/w1rktecz/
  function untilAll(item, selector, fn){
      var sibling = item[fn];
      var siblings = [];
      while(sibling){
          if(matches(sibling, selector) || selector == null) {
              siblings.push(sibling);
          }
          sibling = sibling[fn];
      }

      return siblings;
  }

  /**
  * Gets all next elements matching the passed selector.
  */
  function nextAll(item, selector){
      return untilAll(item, selector, 'nextElementSibling');
  }

  /**
  * Gets all previous elements matching the passed selector.
  */
  function prevAll(item, selector){
      return untilAll(item, selector, 'previousElementSibling');
  }

  /**
  * Converts an object to an array.
  */
  function toArray(objectData){
      return Object.keys(objectData).map(function(key) {
         return objectData[key];
      });
  }

  /**
  * forEach polyfill for IE
  * https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach#Browser_Compatibility
  */
  if (window.NodeList && !NodeList.prototype.forEach) {
      NodeList.prototype.forEach = function (callback, thisArg) {
          thisArg = thisArg || window;
          for (var i = 0; i < this.length; i++) {
              callback.call(thisArg, this[i], i, this);
          }
      };
  }

  //utils are public, so we can use it wherever we want
  window.fp_utils = {
      $: $,
      deepExtend: deepExtend,
      hasClass: hasClass,
      getWindowHeight: getWindowHeight,
      css: css,
      until: until,
      prevUntil: prevUntil,
      nextUntil: nextUntil,
      prev: prev,
      next: next,
      last: last,
      index: index,
      getList: getList,
      hide: hide,
      show: show,
      isArrayOrList: isArrayOrList,
      addClass: addClass,
      removeClass: removeClass,
      appendTo: appendTo,
      wrap: wrap,
      wrapAll: wrapAll,
      wrapInner: wrapInner,
      unwrap: unwrap,
      closest: closest,
      after: after,
      before: before,
      insertBefore: insertBefore,
      getScrollTop: getScrollTop,
      siblings: siblings,
      preventDefault: preventDefault,
      isFunction: isFunction,
      trigger: trigger,
      matches: matches,
      toggle: toggle,
      createElementFromHTML: createElementFromHTML,
      remove: remove,
      filter: filter,
      untilAll: untilAll,
      nextAll: nextAll,
      prevAll: prevAll,
      showError: showError
  };

  return initialise;
}));

/**
* jQuery adapter for fullPage.js 3.0.0
*/
if(window.jQuery && window.fullpage){
  (function ($, fullpage) {
      'use strict';

      // No jQuery No Go
      if (!$ || !fullpage) {
          window.fp_utils.showError('error', 'jQuery is required to use the jQuery fullpage adapter!');
          return;
      }

      $.fn.fullpage = function(options) {
          options = $.extend({}, options, {'$': $});
          var instance = new fullpage(this[0], options);
      };
  })(window.jQuery, window.fullpage);
}
