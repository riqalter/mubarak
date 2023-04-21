
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.58.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }

    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      if (staticProps) _defineProperties(Constructor, staticProps);
      return Constructor;
    }

    function normalizeComputedStyleValue(string) {
      // "250px" --> 250
      return +string.replace(/px/, '');
    }

    function fixDPR(canvas) {
      var dpr = window.devicePixelRatio;
      var computedStyles = getComputedStyle(canvas);
      var width = normalizeComputedStyleValue(computedStyles.getPropertyValue('width'));
      var height = normalizeComputedStyleValue(computedStyles.getPropertyValue('height'));
      canvas.setAttribute('width', (width * dpr).toString());
      canvas.setAttribute('height', (height * dpr).toString());
    }

    function generateRandomNumber(min, max) {
      var fractionDigits = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
      var randomNumber = Math.random() * (max - min) + min;
      return Math.floor(randomNumber * Math.pow(10, fractionDigits)) / Math.pow(10, fractionDigits);
    }

    function generateRandomArrayElement(arr) {
      return arr[generateRandomNumber(0, arr.length)];
    }

    var FREE_FALLING_OBJECT_ACCELERATION = 0.00125;
    var MIN_DRAG_FORCE_COEFFICIENT = 0.0005;
    var MAX_DRAG_FORCE_COEFFICIENT = 0.0009;
    var ROTATION_SLOWDOWN_ACCELERATION = 0.00001;
    var INITIAL_SHAPE_RADIUS = 6;
    var INITIAL_EMOJI_SIZE = 80;
    var MIN_INITIAL_CONFETTI_SPEED = 0.9;
    var MAX_INITIAL_CONFETTI_SPEED = 1.7;
    var MIN_FINAL_X_CONFETTI_SPEED = 0.2;
    var MAX_FINAL_X_CONFETTI_SPEED = 0.6;
    var MIN_INITIAL_ROTATION_SPEED = 0.03;
    var MAX_INITIAL_ROTATION_SPEED = 0.07;
    var MIN_CONFETTI_ANGLE = 15;
    var MAX_CONFETTI_ANGLE = 82;
    var MAX_CONFETTI_POSITION_SHIFT = 150;
    var SHAPE_VISIBILITY_TRESHOLD = 100;
    var DEFAULT_CONFETTI_NUMBER = 250;
    var DEFAULT_EMOJIS_NUMBER = 40;
    var DEFAULT_CONFETTI_COLORS = ['#fcf403', '#62fc03', '#f4fc03', '#03e7fc', '#03fca5', '#a503fc', '#fc03ad', '#fc03c2'];

    function getWindowWidthCoefficient(canvasWidth) {
      var HD_SCREEN_WIDTH = 1920;
      return Math.log(canvasWidth) / Math.log(HD_SCREEN_WIDTH);
    }

    var ConfettiShape = /*#__PURE__*/function () {
      function ConfettiShape(args) {
        _classCallCheck(this, ConfettiShape);

        var initialPosition = args.initialPosition,
            direction = args.direction,
            confettiRadius = args.confettiRadius,
            confettiColors = args.confettiColors,
            emojis = args.emojis,
            emojiSize = args.emojiSize,
            canvasWidth = args.canvasWidth;
        var randomConfettiSpeed = generateRandomNumber(MIN_INITIAL_CONFETTI_SPEED, MAX_INITIAL_CONFETTI_SPEED, 3);
        var initialSpeed = randomConfettiSpeed * getWindowWidthCoefficient(canvasWidth);
        this.confettiSpeed = {
          x: initialSpeed,
          y: initialSpeed
        };
        this.finalConfettiSpeedX = generateRandomNumber(MIN_FINAL_X_CONFETTI_SPEED, MAX_FINAL_X_CONFETTI_SPEED, 3);
        this.rotationSpeed = emojis.length ? 0.01 : generateRandomNumber(MIN_INITIAL_ROTATION_SPEED, MAX_INITIAL_ROTATION_SPEED, 3) * getWindowWidthCoefficient(canvasWidth);
        this.dragForceCoefficient = generateRandomNumber(MIN_DRAG_FORCE_COEFFICIENT, MAX_DRAG_FORCE_COEFFICIENT, 6);
        this.radius = {
          x: confettiRadius,
          y: confettiRadius
        };
        this.initialRadius = confettiRadius;
        this.rotationAngle = direction === 'left' ? generateRandomNumber(0, 0.2, 3) : generateRandomNumber(-0.2, 0, 3);
        this.emojiSize = emojiSize;
        this.emojiRotationAngle = generateRandomNumber(0, 2 * Math.PI);
        this.radiusYUpdateDirection = 'down';
        var angle = direction === 'left' ? generateRandomNumber(MAX_CONFETTI_ANGLE, MIN_CONFETTI_ANGLE) * Math.PI / 180 : generateRandomNumber(-MIN_CONFETTI_ANGLE, -MAX_CONFETTI_ANGLE) * Math.PI / 180;
        this.absCos = Math.abs(Math.cos(angle));
        this.absSin = Math.abs(Math.sin(angle));
        var positionShift = generateRandomNumber(-MAX_CONFETTI_POSITION_SHIFT, 0);
        var shiftedInitialPosition = {
          x: initialPosition.x + (direction === 'left' ? -positionShift : positionShift) * this.absCos,
          y: initialPosition.y - positionShift * this.absSin
        };
        this.currentPosition = Object.assign({}, shiftedInitialPosition);
        this.initialPosition = Object.assign({}, shiftedInitialPosition);
        this.color = emojis.length ? null : generateRandomArrayElement(confettiColors);
        this.emoji = emojis.length ? generateRandomArrayElement(emojis) : null;
        this.createdAt = new Date().getTime();
        this.direction = direction;
      }

      _createClass(ConfettiShape, [{
        key: "draw",
        value: function draw(canvasContext) {
          var currentPosition = this.currentPosition,
              radius = this.radius,
              color = this.color,
              emoji = this.emoji,
              rotationAngle = this.rotationAngle,
              emojiRotationAngle = this.emojiRotationAngle,
              emojiSize = this.emojiSize;
          var dpr = window.devicePixelRatio;

          if (color) {
            canvasContext.fillStyle = color;
            canvasContext.beginPath();
            canvasContext.ellipse(currentPosition.x * dpr, currentPosition.y * dpr, radius.x * dpr, radius.y * dpr, rotationAngle, 0, 2 * Math.PI);
            canvasContext.fill();
          } else if (emoji) {
            canvasContext.font = "".concat(emojiSize, "px serif");
            canvasContext.save();
            canvasContext.translate(dpr * currentPosition.x, dpr * currentPosition.y);
            canvasContext.rotate(emojiRotationAngle);
            canvasContext.textAlign = 'center';
            canvasContext.fillText(emoji, 0, 0);
            canvasContext.restore();
          }
        }
      }, {
        key: "updatePosition",
        value: function updatePosition(iterationTimeDelta, currentTime) {
          var confettiSpeed = this.confettiSpeed,
              dragForceCoefficient = this.dragForceCoefficient,
              finalConfettiSpeedX = this.finalConfettiSpeedX,
              radiusYUpdateDirection = this.radiusYUpdateDirection,
              rotationSpeed = this.rotationSpeed,
              createdAt = this.createdAt,
              direction = this.direction;
          var timeDeltaSinceCreation = currentTime - createdAt;
          if (confettiSpeed.x > finalConfettiSpeedX) this.confettiSpeed.x -= dragForceCoefficient * iterationTimeDelta;
          this.currentPosition.x += confettiSpeed.x * (direction === 'left' ? -this.absCos : this.absCos) * iterationTimeDelta;
          this.currentPosition.y = this.initialPosition.y - confettiSpeed.y * this.absSin * timeDeltaSinceCreation + FREE_FALLING_OBJECT_ACCELERATION * Math.pow(timeDeltaSinceCreation, 2) / 2;
          this.rotationSpeed -= this.emoji ? 0.0001 : ROTATION_SLOWDOWN_ACCELERATION * iterationTimeDelta;
          if (this.rotationSpeed < 0) this.rotationSpeed = 0; // no need to update rotation radius for emoji

          if (this.emoji) {
            this.emojiRotationAngle += this.rotationSpeed * iterationTimeDelta % (2 * Math.PI);
            return;
          }

          if (radiusYUpdateDirection === 'down') {
            this.radius.y -= iterationTimeDelta * rotationSpeed;

            if (this.radius.y <= 0) {
              this.radius.y = 0;
              this.radiusYUpdateDirection = 'up';
            }
          } else {
            this.radius.y += iterationTimeDelta * rotationSpeed;

            if (this.radius.y >= this.initialRadius) {
              this.radius.y = this.initialRadius;
              this.radiusYUpdateDirection = 'down';
            }
          }
        }
      }, {
        key: "getIsVisibleOnCanvas",
        value: function getIsVisibleOnCanvas(canvasHeight) {
          return this.currentPosition.y < canvasHeight + SHAPE_VISIBILITY_TRESHOLD;
        }
      }]);

      return ConfettiShape;
    }();

    function createCanvas() {
      var canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.zIndex = '1000';
      canvas.style.pointerEvents = 'none';
      document.body.appendChild(canvas);
      return canvas;
    }

    function normalizeConfettiConfig(confettiConfig) {
      var _confettiConfig$confe = confettiConfig.confettiRadius,
          confettiRadius = _confettiConfig$confe === void 0 ? INITIAL_SHAPE_RADIUS : _confettiConfig$confe,
          _confettiConfig$confe2 = confettiConfig.confettiNumber,
          confettiNumber = _confettiConfig$confe2 === void 0 ? confettiConfig.confettiesNumber || (confettiConfig.emojis ? DEFAULT_EMOJIS_NUMBER : DEFAULT_CONFETTI_NUMBER) : _confettiConfig$confe2,
          _confettiConfig$confe3 = confettiConfig.confettiColors,
          confettiColors = _confettiConfig$confe3 === void 0 ? DEFAULT_CONFETTI_COLORS : _confettiConfig$confe3,
          _confettiConfig$emoji = confettiConfig.emojis,
          emojis = _confettiConfig$emoji === void 0 ? confettiConfig.emojies || [] : _confettiConfig$emoji,
          _confettiConfig$emoji2 = confettiConfig.emojiSize,
          emojiSize = _confettiConfig$emoji2 === void 0 ? INITIAL_EMOJI_SIZE : _confettiConfig$emoji2; // deprecate wrong plural forms, used in early releases

      if (confettiConfig.emojies) console.error("emojies argument is deprecated, please use emojis instead");
      if (confettiConfig.confettiesNumber) console.error("confettiesNumber argument is deprecated, please use confettiNumber instead");
      return {
        confettiRadius: confettiRadius,
        confettiNumber: confettiNumber,
        confettiColors: confettiColors,
        emojis: emojis,
        emojiSize: emojiSize
      };
    }

    var ConfettiBatch = /*#__PURE__*/function () {
      function ConfettiBatch(canvasContext) {
        var _this = this;

        _classCallCheck(this, ConfettiBatch);

        this.canvasContext = canvasContext;
        this.shapes = [];
        this.promise = new Promise(function (completionCallback) {
          return _this.resolvePromise = completionCallback;
        });
      }

      _createClass(ConfettiBatch, [{
        key: "getBatchCompletePromise",
        value: function getBatchCompletePromise() {
          return this.promise;
        }
      }, {
        key: "addShapes",
        value: function addShapes() {
          var _this$shapes;

          (_this$shapes = this.shapes).push.apply(_this$shapes, arguments);
        }
      }, {
        key: "complete",
        value: function complete() {
          var _a;

          if (this.shapes.length) {
            return false;
          }

          (_a = this.resolvePromise) === null || _a === void 0 ? void 0 : _a.call(this);
          return true;
        }
      }, {
        key: "processShapes",
        value: function processShapes(time, canvasHeight, cleanupInvisibleShapes) {
          var _this2 = this;

          var timeDelta = time.timeDelta,
              currentTime = time.currentTime;
          this.shapes = this.shapes.filter(function (shape) {
            // Render the shapes in this batch
            shape.updatePosition(timeDelta, currentTime);
            shape.draw(_this2.canvasContext); // Only cleanup the shapes if we're being asked to

            if (!cleanupInvisibleShapes) {
              return true;
            }

            return shape.getIsVisibleOnCanvas(canvasHeight);
          });
        }
      }]);

      return ConfettiBatch;
    }();

    var JSConfetti = /*#__PURE__*/function () {
      function JSConfetti() {
        var jsConfettiConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, JSConfetti);

        this.activeConfettiBatches = [];
        this.canvas = jsConfettiConfig.canvas || createCanvas();
        this.canvasContext = this.canvas.getContext('2d');
        this.requestAnimationFrameRequested = false;
        this.lastUpdated = new Date().getTime();
        this.iterationIndex = 0;
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
      }

      _createClass(JSConfetti, [{
        key: "loop",
        value: function loop() {
          this.requestAnimationFrameRequested = false;
          fixDPR(this.canvas);
          var currentTime = new Date().getTime();
          var timeDelta = currentTime - this.lastUpdated;
          var canvasHeight = this.canvas.offsetHeight;
          var cleanupInvisibleShapes = this.iterationIndex % 10 === 0;
          this.activeConfettiBatches = this.activeConfettiBatches.filter(function (batch) {
            batch.processShapes({
              timeDelta: timeDelta,
              currentTime: currentTime
            }, canvasHeight, cleanupInvisibleShapes); // Do not remove invisible shapes on every iteration

            if (!cleanupInvisibleShapes) {
              return true;
            }

            return !batch.complete();
          });
          this.iterationIndex++;
          this.queueAnimationFrameIfNeeded(currentTime);
        }
      }, {
        key: "queueAnimationFrameIfNeeded",
        value: function queueAnimationFrameIfNeeded(currentTime) {
          if (this.requestAnimationFrameRequested) {
            // We already have a pended animation frame, so there is no more work
            return;
          }

          if (this.activeConfettiBatches.length < 1) {
            // No shapes to animate, so don't queue another frame
            return;
          }

          this.requestAnimationFrameRequested = true; // Capture the last updated time for animation

          this.lastUpdated = currentTime || new Date().getTime();
          requestAnimationFrame(this.loop);
        }
      }, {
        key: "addConfetti",
        value: function addConfetti() {
          var confettiConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

          var _normalizeConfettiCon = normalizeConfettiConfig(confettiConfig),
              confettiRadius = _normalizeConfettiCon.confettiRadius,
              confettiNumber = _normalizeConfettiCon.confettiNumber,
              confettiColors = _normalizeConfettiCon.confettiColors,
              emojis = _normalizeConfettiCon.emojis,
              emojiSize = _normalizeConfettiCon.emojiSize; // Use the bounding rect rather tahn the canvas width / height, because
          // .width / .height are unset until a layout pass has been completed. Upon
          // confetti being immediately queued on a page load, this hasn't happened so
          // the default of 300x150 will be returned, causing an improper source point
          // for the confetti animation.


          var canvasRect = this.canvas.getBoundingClientRect();
          var canvasWidth = canvasRect.width;
          var canvasHeight = canvasRect.height;
          var yPosition = canvasHeight * 5 / 7;
          var leftConfettiPosition = {
            x: 0,
            y: yPosition
          };
          var rightConfettiPosition = {
            x: canvasWidth,
            y: yPosition
          };
          var confettiGroup = new ConfettiBatch(this.canvasContext);

          for (var i = 0; i < confettiNumber / 2; i++) {
            var confettiOnTheRight = new ConfettiShape({
              initialPosition: leftConfettiPosition,
              direction: 'right',
              confettiRadius: confettiRadius,
              confettiColors: confettiColors,
              confettiNumber: confettiNumber,
              emojis: emojis,
              emojiSize: emojiSize,
              canvasWidth: canvasWidth
            });
            var confettiOnTheLeft = new ConfettiShape({
              initialPosition: rightConfettiPosition,
              direction: 'left',
              confettiRadius: confettiRadius,
              confettiColors: confettiColors,
              confettiNumber: confettiNumber,
              emojis: emojis,
              emojiSize: emojiSize,
              canvasWidth: canvasWidth
            });
            confettiGroup.addShapes(confettiOnTheRight, confettiOnTheLeft);
          }

          this.activeConfettiBatches.push(confettiGroup);
          this.queueAnimationFrameIfNeeded();
          return confettiGroup.getBatchCompletePromise();
        }
      }, {
        key: "clearCanvas",
        value: function clearCanvas() {
          this.activeConfettiBatches = [];
        }
      }]);

      return JSConfetti;
    }();

    /* src\App.svelte generated by Svelte v3.58.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let link;
    	let script;
    	let script_src_value;
    	let title_value;
    	let t0;
    	let main;
    	let div;
    	let p0;
    	let t2;
    	let h1;
    	let t4;
    	let h2;
    	let t7;
    	let p1;
    	let t11;
    	let p2;
    	let t12;
    	let p2_class_value;
    	let t13;
    	let span;
    	let t14;
    	let span_class_value;
    	let t15;
    	let p3;
    	let t17;
    	let footer;
    	let p4;
    	let t18_value = /*date*/ ctx[2].getFullYear() + "";
    	let t18;
    	let t19;
    	let a0;
    	let t21;
    	let a1;
    	let mounted;
    	let dispose;
    	document.title = title_value = "\r\n    Happy Eid Mubarak " + /*year*/ ctx[3] + "H | Mikail Thoriq\r\n  ";

    	const block = {
    		c: function create() {
    			link = element("link");
    			script = element("script");
    			t0 = space();
    			main = element("main");
    			div = element("div");
    			p0 = element("p");
    			p0.textContent = "🕌";
    			t2 = space();
    			h1 = element("h1");
    			h1.textContent = "Eid Mubarak!";
    			t4 = space();
    			h2 = element("h2");
    			h2.textContent = `${/*year*/ ctx[3]} Hijriah`;
    			t7 = space();
    			p1 = element("p");
    			p1.textContent = `Selamat hari raya Idul Fitri ${/*year*/ ctx[3]} H`;
    			t11 = space();
    			p2 = element("p");
    			t12 = text("Mohon Maaf Lahir dan Batin");
    			t13 = space();
    			span = element("span");
    			t14 = text("🤝");
    			t15 = space();
    			p3 = element("p");
    			p3.textContent = "Klik untuk bersalaman";
    			t17 = space();
    			footer = element("footer");
    			p4 = element("p");
    			t18 = text(t18_value);
    			t19 = text(" | mikail thoriq - Built with\r\n      ");
    			a0 = element("a");
    			a0.textContent = "Svelte";
    			t21 = text("\r\n      powered by ");
    			a1 = element("a");
    			a1.textContent = "Vercel";
    			attr_dev(link, "rel", "stylesheet");
    			attr_dev(link, "href", "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css");
    			add_location(link, file, 30, 2, 535);
    			if (!src_url_equal(script.src, script_src_value = "https://cdn.jsdelivr.net/npm/js-confetti@latest/dist/js-confetti.browser.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file, 34, 2, 657);
    			attr_dev(p0, "class", "wonder svelte-lun579");
    			add_location(p0, file, 44, 4, 918);
    			attr_dev(h1, "class", "svelte-lun579");
    			add_location(h1, file, 45, 4, 948);
    			attr_dev(h2, "class", "svelte-lun579");
    			add_location(h2, file, 46, 4, 975);
    			attr_dev(p1, "class", "svelte-lun579");
    			add_location(p1, file, 47, 4, 1004);

    			attr_dev(p2, "class", p2_class_value = "" + (null_to_empty(/*maaf*/ ctx[1]
    			? "maaf animate__animated animate__heartBeat"
    			: "maaf") + " svelte-lun579"));

    			add_location(p2, file, 48, 4, 1054);

    			attr_dev(span, "class", span_class_value = "" + (null_to_empty(/*shake*/ ctx[0]
    			? "salam animate__animated animate__shakeY"
    			: "salam") + " svelte-lun579"));

    			add_location(span, file, 52, 4, 1237);
    			attr_dev(p3, "class", "salam-teks svelte-lun579");
    			add_location(p3, file, 58, 4, 1440);
    			attr_dev(div, "class", "animate__animated animate__fadeIn svelte-lun579");
    			add_location(div, file, 43, 2, 865);
    			attr_dev(a0, "href", "https://svelte.dev/");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "class", "svelte-lun579");
    			add_location(a0, file, 63, 6, 1607);
    			attr_dev(a1, "href", "https://vercel.com/");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "class", "svelte-lun579");
    			add_location(a1, file, 64, 17, 1682);
    			attr_dev(p4, "class", "svelte-lun579");
    			add_location(p4, file, 61, 4, 1539);
    			attr_dev(footer, "class", "svelte-lun579");
    			add_location(footer, file, 60, 2, 1525);
    			attr_dev(main, "class", "svelte-lun579");
    			add_location(main, file, 42, 0, 855);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, link);
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, p0);
    			append_dev(div, t2);
    			append_dev(div, h1);
    			append_dev(div, t4);
    			append_dev(div, h2);
    			append_dev(div, t7);
    			append_dev(div, p1);
    			append_dev(div, t11);
    			append_dev(div, p2);
    			append_dev(p2, t12);
    			append_dev(div, t13);
    			append_dev(div, span);
    			append_dev(span, t14);
    			append_dev(div, t15);
    			append_dev(div, p3);
    			append_dev(main, t17);
    			append_dev(main, footer);
    			append_dev(footer, p4);
    			append_dev(p4, t18);
    			append_dev(p4, t19);
    			append_dev(p4, a0);
    			append_dev(p4, t21);
    			append_dev(p4, a1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(span, "click", /*showConfetti*/ ctx[4], false, false, false, false),
    					listen_dev(p3, "click", /*showConfetti*/ ctx[4], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*year*/ 8 && title_value !== (title_value = "\r\n    Happy Eid Mubarak " + /*year*/ ctx[3] + "H | Mikail Thoriq\r\n  ")) {
    				document.title = title_value;
    			}

    			if (dirty & /*maaf*/ 2 && p2_class_value !== (p2_class_value = "" + (null_to_empty(/*maaf*/ ctx[1]
    			? "maaf animate__animated animate__heartBeat"
    			: "maaf") + " svelte-lun579"))) {
    				attr_dev(p2, "class", p2_class_value);
    			}

    			if (dirty & /*shake*/ 1 && span_class_value !== (span_class_value = "" + (null_to_empty(/*shake*/ ctx[0]
    			? "salam animate__animated animate__shakeY"
    			: "salam") + " svelte-lun579"))) {
    				attr_dev(span, "class", span_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			detach_dev(link);
    			detach_dev(script);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const confetti = new JSConfetti();
    	const date = new Date();
    	let year = "1444";
    	let shake = false;
    	let maaf = false;

    	function showConfetti() {
    		confetti.addConfetti();
    		$$invalidate(1, maaf = true);
    		$$invalidate(0, shake = true);

    		setTimeout(
    			() => {
    				$$invalidate(0, shake = false);
    				$$invalidate(1, maaf = false);
    			},
    			1000
    		);
    	}

    	function intro() {
    		confetti.addConfetti();
    	}

    	onMount(() => {
    		intro();
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		JSConfetti,
    		onMount,
    		confetti,
    		date,
    		year,
    		shake,
    		maaf,
    		showConfetti,
    		intro
    	});

    	$$self.$inject_state = $$props => {
    		if ('year' in $$props) $$invalidate(3, year = $$props.year);
    		if ('shake' in $$props) $$invalidate(0, shake = $$props.shake);
    		if ('maaf' in $$props) $$invalidate(1, maaf = $$props.maaf);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [shake, maaf, date, year, showConfetti];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
