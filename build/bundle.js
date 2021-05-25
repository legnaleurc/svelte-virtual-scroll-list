function noop() { }
const identity = x => x;
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
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
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
    const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function compute_slots(slots) {
    const result = {};
    for (const key in slots) {
        result[key] = true;
    }
    return result;
}
function set_store_value(store, ret, value = ret) {
    store.set(value);
    return ret;
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
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
function empty() {
    return text('');
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
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

const active_docs = new Set();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = node.ownerDocument;
    active_docs.add(doc);
    const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
    const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
    if (!current_rules[name]) {
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        active_docs.forEach(doc => {
            const stylesheet = doc.__svelte_stylesheet;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            doc.__svelte_rules = {};
        });
        active_docs.clear();
    });
}

function create_animation(node, from, fn, params) {
    if (!from)
        return noop;
    const to = node.getBoundingClientRect();
    if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
        return noop;
    const { delay = 0, duration = 300, easing = identity, 
    // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
    start: start_time = now() + delay, 
    // @ts-ignore todo:
    end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
    let running = true;
    let started = false;
    let name;
    function start() {
        if (css) {
            name = create_rule(node, 0, 1, duration, delay, easing, css);
        }
        if (!delay) {
            started = true;
        }
    }
    function stop() {
        if (css)
            delete_rule(node, name);
        running = false;
    }
    loop(now => {
        if (!started && now >= start_time) {
            started = true;
        }
        if (started && now >= end) {
            tick(1, 0);
            stop();
        }
        if (!running) {
            return false;
        }
        if (started) {
            const p = now - start_time;
            const t = 0 + 1 * easing(p / duration);
            tick(t, 1 - t);
        }
        return true;
    });
    start();
    tick(0, 1);
    return stop;
}
function fix_position(node) {
    const style = getComputedStyle(node);
    if (style.position !== 'absolute' && style.position !== 'fixed') {
        const { width, height } = style;
        const a = node.getBoundingClientRect();
        node.style.position = 'absolute';
        node.style.width = width;
        node.style.height = height;
        add_transform(node, a);
    }
}
function add_transform(node, a) {
    const b = node.getBoundingClientRect();
    if (a.left !== b.left || a.top !== b.top) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
    }
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
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function tick() {
    schedule_update();
    return resolved_promise;
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
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
    flushing = false;
    seen_callbacks.clear();
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
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

function destroy_block(block, lookup) {
    block.d(1);
    lookup.delete(block.key);
}
function outro_and_destroy_block(block, lookup) {
    transition_out(block, 1, 1, () => {
        lookup.delete(block.key);
    });
}
function fix_and_destroy_block(block, lookup) {
    block.f();
    destroy_block(block, lookup);
}
function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else if (dynamic) {
            block.p(child_ctx, dirty);
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    return new_blocks;
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function get_spread_object(spread_props) {
    return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
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
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
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
        context: new Map(parent_component ? parent_component.$$.context : options.context || []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
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

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}

function flip(node, animation, params = {}) {
    const style = getComputedStyle(node);
    const transform = style.transform === 'none' ? '' : style.transform;
    const scaleX = animation.from.width / node.clientWidth;
    const scaleY = animation.from.height / node.clientHeight;
    const dx = (animation.from.left - animation.to.left) / scaleX;
    const dy = (animation.from.top - animation.to.top) / scaleY;
    const d = Math.sqrt(dx * dx + dy * dy);
    const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
    return {
        delay,
        duration: is_function(duration) ? duration(d) : duration,
        easing,
        css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
    };
}

/**
 * virtual list core calculating center
 */

const DIRECTION_TYPE = {
    FRONT: "FRONT", // scroll up or left
    BEHIND: "BEHIND", // scroll down or right
};
const CALC_TYPE = {
    INIT: "INIT",
    FIXED: "FIXED",
    DYNAMIC: "DYNAMIC",
};
const LEADING_BUFFER = 2;

class Virtual {
    param
    callUpdate
    firstRangeTotalSize = 0
    firstRangeAverageSize = 0
    lastCalcIndex = 0
    fixedSizeValue = 0
    calcType = CALC_TYPE.INIT
    offset = 0
    direction = ""
    range

    constructor(param, callUpdate) {
        this.init(param, callUpdate);
    }

    init(param, callUpdate) {
        // param data
        this.param = param;
        this.callUpdate = callUpdate;

        // size data
        this.sizes = new Map();
        this.firstRangeTotalSize = 0;
        this.firstRangeAverageSize = 0;
        this.lastCalcIndex = 0;
        this.fixedSizeValue = 0;
        this.calcType = CALC_TYPE.INIT;

        // scroll data
        this.offset = 0;
        this.direction = "";

        // range data
        this.range = Object.create(null);
        if (param) {
            this.checkRange(0, param.keeps - 1);
        }

        // benchmark example data
        // this.__bsearchCalls = 0
        // this.__getIndexOffsetCalls = 0
    }

    destroy() {
        this.init(null, null);
    }

    // return current render range
    getRange() {
        const range = Object.create(null);
        range.start = this.range.start;
        range.end = this.range.end;
        range.padFront = this.range.padFront;
        range.padBehind = this.range.padBehind;
        return range
    }

    isBehind() {
        return this.direction === DIRECTION_TYPE.BEHIND
    }

    isFront() {
        return this.direction === DIRECTION_TYPE.FRONT
    }

    // return start index offset
    getOffset(start) {
        return (start < 1 ? 0 : this.getIndexOffset(start)) + this.param.slotHeaderSize
    }

    updateParam(key, value) {
        if (this.param && (key in this.param)) {
            // if uniqueIds change, find out deleted id and remove from size map
            if (key === "uniqueIds") {
                this.sizes.forEach((v, key) => {
                    if (!value.includes(key)) {
                        this.sizes.delete(key);
                    }
                });
            }
            this.param[key] = value;
        }
    }

    // save each size map by id
    saveSize(id, size) {
        this.sizes.set(id, size);

        // we assume size type is fixed at the beginning and remember first size value
        // if there is no size value different from this at next coming saving
        // we think it's a fixed size list, otherwise is dynamic size list
        if (this.calcType === CALC_TYPE.INIT) {
            this.fixedSizeValue = size;
            this.calcType = CALC_TYPE.FIXED;
        } else if (this.calcType === CALC_TYPE.FIXED && this.fixedSizeValue !== size) {
            this.calcType = CALC_TYPE.DYNAMIC;
            // it's no use at all
            delete this.fixedSizeValue;
        }

        // calculate the average size only in the first range
        if (this.calcType !== CALC_TYPE.FIXED && typeof this.firstRangeTotalSize !== "undefined") {
            if (this.sizes.size < Math.min(this.param.keeps, this.param.uniqueIds.length)) {
                this.firstRangeTotalSize = [...this.sizes.values()].reduce((acc, val) => acc + val, 0);
                this.firstRangeAverageSize = Math.round(this.firstRangeTotalSize / this.sizes.size);
            } else {
                // it's done using
                delete this.firstRangeTotalSize;
            }
        }
    }

    // in some special situation (e.g. length change) we need to update in a row
    // try going to render next range by a leading buffer according to current direction
    handleDataSourcesChange() {
        let start = this.range.start;

        if (this.isFront()) {
            start = start - LEADING_BUFFER;
        } else if (this.isBehind()) {
            start = start + LEADING_BUFFER;
        }

        start = Math.max(start, 0);

        this.updateRange(this.range.start, this.getEndByStart(start));
    }

    // when slot size change, we also need force update
    handleSlotSizeChange() {
        this.handleDataSourcesChange();
    }

    // calculating range on scroll
    handleScroll(offset) {
        this.direction = offset < this.offset ? DIRECTION_TYPE.FRONT : DIRECTION_TYPE.BEHIND;
        this.offset = offset;

        if (!this.param) {
            return
        }

        if (this.direction === DIRECTION_TYPE.FRONT) {
            this.handleFront();
        } else if (this.direction === DIRECTION_TYPE.BEHIND) {
            this.handleBehind();
        }
    }

    // ----------- public method end -----------

    handleFront() {
        const overs = this.getScrollOvers();
        // should not change range if start doesn't exceed overs
        if (overs > this.range.start) {
            return
        }

        // move up start by a buffer length, and make sure its safety
        const start = Math.max(overs - this.param.buffer, 0);
        this.checkRange(start, this.getEndByStart(start));
    }

    handleBehind() {
        const overs = this.getScrollOvers();
        // range should not change if scroll overs within buffer
        if (overs < this.range.start + this.param.buffer) {
            return
        }

        this.checkRange(overs, this.getEndByStart(overs));
    }

    // return the pass overs according to current scroll offset
    getScrollOvers() {
        // if slot header exist, we need subtract its size
        const offset = this.offset - this.param.slotHeaderSize;
        if (offset <= 0) {
            return 0
        }

        // if is fixed type, that can be easily
        if (this.isFixedType()) {
            return Math.floor(offset / this.fixedSizeValue)
        }

        let low = 0;
        let middle = 0;
        let middleOffset = 0;
        let high = this.param.uniqueIds.length;

        while (low <= high) {
            // this.__bsearchCalls++
            middle = low + Math.floor((high - low) / 2);
            middleOffset = this.getIndexOffset(middle);

            if (middleOffset === offset) {
                return middle
            } else if (middleOffset < offset) {
                low = middle + 1;
            } else if (middleOffset > offset) {
                high = middle - 1;
            }
        }

        return low > 0 ? --low : 0
    }

    // return a scroll offset from given index, can efficiency be improved more here?
    // although the call frequency is very high, its only a superposition of numbers
    getIndexOffset(givenIndex) {
        if (!givenIndex) {
            return 0
        }

        let offset = 0;
        let indexSize = 0;
        for (let index = 0; index < givenIndex; index++) {
            // this.__getIndexOffsetCalls++
            indexSize = this.sizes.get(this.param.uniqueIds[index]);
            offset = offset + (typeof indexSize === "number" ? indexSize : this.getEstimateSize());
        }

        // remember last calculate index
        this.lastCalcIndex = Math.max(this.lastCalcIndex, givenIndex - 1);
        this.lastCalcIndex = Math.min(this.lastCalcIndex, this.getLastIndex());

        return offset
    }

    // is fixed size type
    isFixedType() {
        return this.calcType === CALC_TYPE.FIXED
    }

    // return the real last index
    getLastIndex() {
        return this.param.uniqueIds.length - 1
    }

    // in some conditions range is broke, we need correct it
    // and then decide whether need update to next range
    checkRange(start, end) {
        const keeps = this.param.keeps;
        const total = this.param.uniqueIds.length;

        // data less than keeps, render all
        if (total <= keeps) {
            start = 0;
            end = this.getLastIndex();
        } else if (end - start < keeps - 1) {
            // if range length is less than keeps, correct it base on end
            start = end - keeps + 1;
        }

        if (this.range.start !== start) {
            this.updateRange(start, end);
        }
    }

    // setting to a new range and rerender
    updateRange(start, end) {
        this.range.start = start;
        this.range.end = end;
        this.range.padFront = this.getPadFront();
        this.range.padBehind = this.getPadBehind();
        this.callUpdate(this.getRange());
    }

    // return end base on start
    getEndByStart(start) {
        const theoryEnd = start + this.param.keeps - 1;
        const truelyEnd = Math.min(theoryEnd, this.getLastIndex());
        return truelyEnd
    }

    // return total front offset
    getPadFront() {
        if (this.isFixedType()) {
            return this.fixedSizeValue * this.range.start
        } else {
            return this.getIndexOffset(this.range.start)
        }
    }

    // return total behind offset
    getPadBehind() {
        const end = this.range.end;
        const lastIndex = this.getLastIndex();

        if (this.isFixedType()) {
            return (lastIndex - end) * this.fixedSizeValue
        }

        // if it's all calculated, return the exactly offset
        if (this.lastCalcIndex === lastIndex) {
            return this.getIndexOffset(lastIndex) - this.getIndexOffset(end)
        } else {
            // if not, use a estimated value
            return (lastIndex - end) * this.getEstimateSize()
        }
    }

    // get the item estimate size
    getEstimateSize() {
        return this.isFixedType() ? this.fixedSizeValue : (this.firstRangeAverageSize || this.param.estimateSize)
    }
}

/* src/Item.svelte generated by Svelte v3.38.2 */

function create_fragment$8(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[5].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

	return {
		c() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr(div, "class", "virtual-scroll-item");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			/*div_binding*/ ctx[6](div);
			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (default_slot) default_slot.d(detaching);
			/*div_binding*/ ctx[6](null);
		}
	};
}

function instance$8($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { horizontal = false } = $$props;
	let { uniqueKey } = $$props;
	let { type = "item" } = $$props;
	let resizeObserver;
	let itemDiv;
	let previousSize;
	const dispatch = createEventDispatcher();
	const shapeKey = horizontal ? "offsetWidth" : "offsetHeight";

	onMount(() => {
		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(dispatchSizeChange);
			resizeObserver.observe(itemDiv);
		}
	});

	afterUpdate(dispatchSizeChange);

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
	});

	function dispatchSizeChange() {
		const size = itemDiv ? itemDiv[shapeKey] : 0;
		if (size === previousSize) return;
		previousSize = size;
		dispatch("resize", { id: uniqueKey, size, type });
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			itemDiv = $$value;
			$$invalidate(0, itemDiv);
		});
	}

	$$self.$$set = $$props => {
		if ("horizontal" in $$props) $$invalidate(1, horizontal = $$props.horizontal);
		if ("uniqueKey" in $$props) $$invalidate(2, uniqueKey = $$props.uniqueKey);
		if ("type" in $$props) $$invalidate(3, type = $$props.type);
		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
	};

	return [itemDiv, horizontal, uniqueKey, type, $$scope, slots, div_binding];
}

class Item extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { horizontal: 1, uniqueKey: 2, type: 3 });
	}
}

/* src/VirtualScroll.svelte generated by Svelte v3.38.2 */
const get_footer_slot_changes = dirty => ({ data: dirty[0] & /*displayItems*/ 8 });
const get_footer_slot_context = ctx => ({ data: /*data*/ ctx[2] });

function get_each_context$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[2] = list[i];
	return child_ctx;
}

const get_default_slot_changes = dirty => ({ data: dirty[0] & /*displayItems*/ 8 });
const get_default_slot_context = ctx => ({ data: /*data*/ ctx[2] });
const get_header_slot_changes = dirty => ({ data: dirty[0] & /*displayItems*/ 8 });
const get_header_slot_context = ctx => ({ data: /*data*/ ctx[2] });

// (265:4) {#if $$slots.header}
function create_if_block_1(ctx) {
	let item;
	let current;

	item = new Item({
			props: {
				type: "slot",
				uniqueKey: "header",
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			}
		});

	item.$on("resize", /*onItemResized*/ ctx[7]);

	return {
		c() {
			create_component(item.$$.fragment);
		},
		m(target, anchor) {
			mount_component(item, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const item_changes = {};

			if (dirty[0] & /*$$scope, displayItems*/ 536870920) {
				item_changes.$$scope = { dirty, ctx };
			}

			item.$set(item_changes);
		},
		i(local) {
			if (current) return;
			transition_in(item.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(item.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(item, detaching);
		}
	};
}

// (266:8) <Item on:resize={onItemResized} type="slot" uniqueKey="header">
function create_default_slot_2(ctx) {
	let current;
	const header_slot_template = /*#slots*/ ctx[26].header;
	const header_slot = create_slot(header_slot_template, ctx, /*$$scope*/ ctx[29], get_header_slot_context);

	return {
		c() {
			if (header_slot) header_slot.c();
		},
		m(target, anchor) {
			if (header_slot) {
				header_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (header_slot) {
				if (header_slot.p && (!current || dirty[0] & /*$$scope, displayItems*/ 536870920)) {
					update_slot(header_slot, header_slot_template, ctx, /*$$scope*/ ctx[29], dirty, get_header_slot_changes, get_header_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(header_slot, local);
			current = true;
		},
		o(local) {
			transition_out(header_slot, local);
			current = false;
		},
		d(detaching) {
			if (header_slot) header_slot.d(detaching);
		}
	};
}

// (272:12) <Item                     on:resize={onItemResized}                     uniqueKey={data[key]}                     horizontal={isHorizontal}                     type="item">
function create_default_slot_1(ctx) {
	let t;
	let current;
	const default_slot_template = /*#slots*/ ctx[26].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[29], get_default_slot_context);

	return {
		c() {
			if (default_slot) default_slot.c();
			t = space();
		},
		m(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			insert(target, t, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty[0] & /*$$scope, displayItems*/ 536870920)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[29], dirty, get_default_slot_changes, get_default_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (default_slot) default_slot.d(detaching);
			if (detaching) detach(t);
		}
	};
}

// (271:8) {#each displayItems as data (data[key])}
function create_each_block$3(key_2, ctx) {
	let first;
	let item;
	let current;

	item = new Item({
			props: {
				uniqueKey: /*data*/ ctx[2][/*key*/ ctx[0]],
				horizontal: /*isHorizontal*/ ctx[1],
				type: "item",
				$$slots: { default: [create_default_slot_1] },
				$$scope: { ctx }
			}
		});

	item.$on("resize", /*onItemResized*/ ctx[7]);

	return {
		key: key_2,
		first: null,
		c() {
			first = empty();
			create_component(item.$$.fragment);
			this.first = first;
		},
		m(target, anchor) {
			insert(target, first, anchor);
			mount_component(item, target, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const item_changes = {};
			if (dirty[0] & /*displayItems, key*/ 9) item_changes.uniqueKey = /*data*/ ctx[2][/*key*/ ctx[0]];
			if (dirty[0] & /*isHorizontal*/ 2) item_changes.horizontal = /*isHorizontal*/ ctx[1];

			if (dirty[0] & /*$$scope, displayItems*/ 536870920) {
				item_changes.$$scope = { dirty, ctx };
			}

			item.$set(item_changes);
		},
		i(local) {
			if (current) return;
			transition_in(item.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(item.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(first);
			destroy_component(item, detaching);
		}
	};
}

// (281:4) {#if $$slots.footer}
function create_if_block(ctx) {
	let item;
	let current;

	item = new Item({
			props: {
				type: "slot",
				uniqueKey: "footer",
				$$slots: { default: [create_default_slot$5] },
				$$scope: { ctx }
			}
		});

	item.$on("resize", /*onItemResized*/ ctx[7]);

	return {
		c() {
			create_component(item.$$.fragment);
		},
		m(target, anchor) {
			mount_component(item, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const item_changes = {};

			if (dirty[0] & /*$$scope, displayItems*/ 536870920) {
				item_changes.$$scope = { dirty, ctx };
			}

			item.$set(item_changes);
		},
		i(local) {
			if (current) return;
			transition_in(item.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(item.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(item, detaching);
		}
	};
}

// (282:8) <Item on:resize={onItemResized} type="slot" uniqueKey="footer">
function create_default_slot$5(ctx) {
	let current;
	const footer_slot_template = /*#slots*/ ctx[26].footer;
	const footer_slot = create_slot(footer_slot_template, ctx, /*$$scope*/ ctx[29], get_footer_slot_context);

	return {
		c() {
			if (footer_slot) footer_slot.c();
		},
		m(target, anchor) {
			if (footer_slot) {
				footer_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (footer_slot) {
				if (footer_slot.p && (!current || dirty[0] & /*$$scope, displayItems*/ 536870920)) {
					update_slot(footer_slot, footer_slot_template, ctx, /*$$scope*/ ctx[29], dirty, get_footer_slot_changes, get_footer_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(footer_slot, local);
			current = true;
		},
		o(local) {
			transition_out(footer_slot, local);
			current = false;
		},
		d(detaching) {
			if (footer_slot) footer_slot.d(detaching);
		}
	};
}

function create_fragment$7(ctx) {
	let div2;
	let t0;
	let div0;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let t1;
	let t2;
	let div1;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*$$slots*/ ctx[9].header && create_if_block_1(ctx);
	let each_value = /*displayItems*/ ctx[3];
	const get_key = ctx => /*data*/ ctx[2][/*key*/ ctx[0]];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context$3(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
	}

	let if_block1 = /*$$slots*/ ctx[9].footer && create_if_block(ctx);

	return {
		c() {
			div2 = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			if (if_block1) if_block1.c();
			t2 = space();
			div1 = element("div");
			set_style(div0, "padding", /*paddingStyle*/ ctx[4]);
			attr(div1, "class", "shepherd");
			set_style(div1, "width", /*isHorizontal*/ ctx[1] ? "0px" : "100%");
			set_style(div1, "height", /*isHorizontal*/ ctx[1] ? "100%" : "0px");
			set_style(div2, "overflow-y", "auto");
			set_style(div2, "height", "inherit");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			if (if_block0) if_block0.m(div2, null);
			append(div2, t0);
			append(div2, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			append(div2, t1);
			if (if_block1) if_block1.m(div2, null);
			append(div2, t2);
			append(div2, div1);
			/*div1_binding*/ ctx[27](div1);
			/*div2_binding*/ ctx[28](div2);
			current = true;

			if (!mounted) {
				dispose = listen(div2, "scroll", /*onScroll*/ ctx[8]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (/*$$slots*/ ctx[9].header) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty[0] & /*$$slots*/ 512) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_1(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(div2, t0);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (dirty[0] & /*displayItems, key, isHorizontal, onItemResized, $$scope*/ 536871051) {
				each_value = /*displayItems*/ ctx[3];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div0, outro_and_destroy_block, create_each_block$3, null, get_each_context$3);
				check_outros();
			}

			if (!current || dirty[0] & /*paddingStyle*/ 16) {
				set_style(div0, "padding", /*paddingStyle*/ ctx[4]);
			}

			if (/*$$slots*/ ctx[9].footer) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty[0] & /*$$slots*/ 512) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div2, t2);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}

			if (!current || dirty[0] & /*isHorizontal*/ 2) {
				set_style(div1, "width", /*isHorizontal*/ ctx[1] ? "0px" : "100%");
			}

			if (!current || dirty[0] & /*isHorizontal*/ 2) {
				set_style(div1, "height", /*isHorizontal*/ ctx[1] ? "100%" : "0px");
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(if_block0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div2);
			if (if_block0) if_block0.d();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			if (if_block1) if_block1.d();
			/*div1_binding*/ ctx[27](null);
			/*div2_binding*/ ctx[28](null);
			mounted = false;
			dispose();
		}
	};
}

function instance$7($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	const $$slots = compute_slots(slots);
	let { key = "id" } = $$props;
	let { data } = $$props;
	let { keeps = 30 } = $$props;
	let { estimateSize = 50 } = $$props;
	let { isHorizontal = false } = $$props;
	let { start = 0 } = $$props;
	let { offset = 0 } = $$props;
	let { pageMode = false } = $$props;
	let { topThreshold = 0 } = $$props;
	let { bottomThreshold = 0 } = $$props;
	let displayItems = [];
	let paddingStyle;
	let directionKey = isHorizontal ? "scrollLeft" : "scrollTop";
	let range = null;

	let virtual = new Virtual({
			slotHeaderSize: 0,
			slotFooterSize: 0,
			keeps,
			estimateSize,
			buffer: Math.round(keeps / 3), // recommend for a third of keeps
			uniqueIds: getUniqueIdFromDataSources()
		},
	onRangeChanged);

	let root;
	let shepherd;
	const dispatch = createEventDispatcher();

	function getSize(id) {
		return virtual.sizes.get(id);
	}

	function getSizes() {
		return virtual.sizes.size;
	}

	function getOffset() {
		if (pageMode) {
			return document.documentElement[directionKey] || document.body[directionKey];
		} else {
			return root ? Math.ceil(root[directionKey]) : 0;
		}
	}

	function getClientSize() {
		const key = isHorizontal ? "clientWidth" : "clientHeight";

		if (pageMode) {
			return document.documentElement[key] || document.body[key];
		} else {
			return root ? Math.ceil(root[key]) : 0;
		}
	}

	function getScrollSize() {
		const key = isHorizontal ? "scrollWidth" : "scrollHeight";

		if (pageMode) {
			return document.documentElement[key] || document.body[key];
		} else {
			return root ? Math.ceil(root[key]) : 0;
		}
	}

	function updatePageModeFront() {
		if (root) {
			const rect = root.getBoundingClientRect();
			const { defaultView } = root.ownerDocument;

			const offsetFront = isHorizontal
			? rect.left + defaultView.pageXOffset
			: rect.top + defaultView.pageYOffset;

			virtual.updateParam("slotHeaderSize", offsetFront);
		}
	}

	function scrollToOffset(offset) {
		if (pageMode) {
			document.body[directionKey] = offset;
			document.documentElement[directionKey] = offset;
		} else if (root) {
			$$invalidate(5, root[directionKey] = offset, root);
		}
	}

	function scrollToIndex(index) {
		if (index >= data.length - 1) {
			scrollToBottom();
		} else {
			const offset = virtual.getOffset(index);
			scrollToOffset(offset);
		}
	}

	function scrollToBottom() {
		if (shepherd) {
			const offset = shepherd[isHorizontal ? "offsetLeft" : "offsetTop"];
			scrollToOffset(offset);

			// check if it's really scrolled to the bottom
			// maybe list doesn't render and calculate to last range
			// so we need retry in next event loop until it really at bottom
			setTimeout(
				() => {
					if (getOffset() + getClientSize() + 1 < getScrollSize()) {
						scrollToBottom();
					}
				},
				3
			);
		}
	}

	onMount(() => {
		if (start) {
			scrollToIndex(start);
		} else if (offset) {
			scrollToOffset(offset);
		}

		if (pageMode) {
			updatePageModeFront();
			document.addEventListener("scroll", onScroll, { passive: false });
		}
	});

	onDestroy(() => {
		virtual.destroy();

		if (pageMode) {
			document.removeEventListener("scroll", onScroll);
		}
	});

	function getUniqueIdFromDataSources() {
		return data.map(dataSource => dataSource[key]);
	}

	function onItemResized(event) {
		const { id, size, type } = event.detail;

		if (type === "item") virtual.saveSize(id, size); else if (type === "slot") {
			if (id === "header") virtual.updateParam("slotHeaderSize", size); else if (id === "footer") virtual.updateParam("slotFooterSize", size);
		} // virtual.handleSlotSizeChange()
	}

	function onRangeChanged(range_) {
		range = range_;

		$$invalidate(4, paddingStyle = $$invalidate(4, paddingStyle = isHorizontal
		? `0px ${range.padBehind}px 0px ${range.padFront}px`
		: `${range.padFront}px 0px ${range.padBehind}px`));

		$$invalidate(3, displayItems = data.slice(range.start, range.end + 1));
	}

	function onScroll(event) {
		const offset = getOffset();
		const clientSize = getClientSize();
		const scrollSize = getScrollSize();

		// iOS scroll-spring-back behavior will make direction mistake
		if (offset < 0 || offset + clientSize > scrollSize + 1 || !scrollSize) {
			return;
		}

		virtual.handleScroll(offset);
		emitEvent(offset, clientSize, scrollSize, event);
	}

	function emitEvent(offset, clientSize, scrollSize, event) {
		dispatch("scroll", { event, range: virtual.getRange() });

		if (virtual.isFront() && !!data.length && offset - topThreshold <= 0) {
			dispatch("top");
		} else if (virtual.isBehind() && offset + clientSize + bottomThreshold >= scrollSize) {
			dispatch("bottom");
		}
	}

	function handleKeepsChange(keeps) {
		virtual.updateParam("keeps", keeps);
		virtual.handleSlotSizeChange();
	}

	async function handleDataSourcesChange(data) {
		virtual.updateParam("uniqueIds", getUniqueIdFromDataSources());
		virtual.handleDataSourcesChange();
	}

	function div1_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			shepherd = $$value;
			$$invalidate(6, shepherd);
		});
	}

	function div2_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			root = $$value;
			$$invalidate(5, root);
		});
	}

	$$self.$$set = $$props => {
		if ("key" in $$props) $$invalidate(0, key = $$props.key);
		if ("data" in $$props) $$invalidate(2, data = $$props.data);
		if ("keeps" in $$props) $$invalidate(10, keeps = $$props.keeps);
		if ("estimateSize" in $$props) $$invalidate(11, estimateSize = $$props.estimateSize);
		if ("isHorizontal" in $$props) $$invalidate(1, isHorizontal = $$props.isHorizontal);
		if ("start" in $$props) $$invalidate(12, start = $$props.start);
		if ("offset" in $$props) $$invalidate(13, offset = $$props.offset);
		if ("pageMode" in $$props) $$invalidate(14, pageMode = $$props.pageMode);
		if ("topThreshold" in $$props) $$invalidate(15, topThreshold = $$props.topThreshold);
		if ("bottomThreshold" in $$props) $$invalidate(16, bottomThreshold = $$props.bottomThreshold);
		if ("$$scope" in $$props) $$invalidate(29, $$scope = $$props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*offset*/ 8192) {
			scrollToOffset(offset);
		}

		if ($$self.$$.dirty[0] & /*start*/ 4096) {
			scrollToIndex(start);
		}

		if ($$self.$$.dirty[0] & /*keeps*/ 1024) {
			handleKeepsChange(keeps);
		}

		if ($$self.$$.dirty[0] & /*data*/ 4) {
			handleDataSourcesChange();
		}
	};

	return [
		key,
		isHorizontal,
		data,
		displayItems,
		paddingStyle,
		root,
		shepherd,
		onItemResized,
		onScroll,
		$$slots,
		keeps,
		estimateSize,
		start,
		offset,
		pageMode,
		topThreshold,
		bottomThreshold,
		getSize,
		getSizes,
		getOffset,
		getClientSize,
		getScrollSize,
		updatePageModeFront,
		scrollToOffset,
		scrollToIndex,
		scrollToBottom,
		slots,
		div1_binding,
		div2_binding,
		$$scope
	];
}

class VirtualScroll extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance$7,
			create_fragment$7,
			safe_not_equal,
			{
				key: 0,
				data: 2,
				keeps: 10,
				estimateSize: 11,
				isHorizontal: 1,
				start: 12,
				offset: 13,
				pageMode: 14,
				topThreshold: 15,
				bottomThreshold: 16,
				getSize: 17,
				getSizes: 18,
				getOffset: 19,
				getClientSize: 20,
				getScrollSize: 21,
				updatePageModeFront: 22,
				scrollToOffset: 23,
				scrollToIndex: 24,
				scrollToBottom: 25
			},
			[-1, -1]
		);
	}

	get getSize() {
		return this.$$.ctx[17];
	}

	get getSizes() {
		return this.$$.ctx[18];
	}

	get getOffset() {
		return this.$$.ctx[19];
	}

	get getClientSize() {
		return this.$$.ctx[20];
	}

	get getScrollSize() {
		return this.$$.ctx[21];
	}

	get updatePageModeFront() {
		return this.$$.ctx[22];
	}

	get scrollToOffset() {
		return this.$$.ctx[23];
	}

	get scrollToIndex() {
		return this.$$.ctx[24];
	}

	get scrollToBottom() {
		return this.$$.ctx[25];
	}
}

(
    "Что такое Lorem Ipsum?\n" +
    "Lorem Ipsum - это текст-\"рыба\", часто используемый в печати и вэб-дизайне. Lorem Ipsum является стандартной \"рыбой\" для текстов на латинице с начала XVI века. В то время некий безымянный печатник создал большую коллекцию размеров и форм шрифтов, используя Lorem Ipsum для распечатки образцов. Lorem Ipsum не только успешно пережил без заметных изменений пять веков, но и перешагнул в электронный дизайн. Его популяризации в новое время послужили публикация листов Letraset с образцами Lorem Ipsum в 60-х годах и, в более недавнее время, программы электронной вёрстки типа Aldus PageMaker, в шаблонах которых используется Lorem Ipsum.\n" +
    "\n" +
    "Почему он используется?\n" +
    "Давно выяснено, что при оценке дизайна и композиции читаемый текст мешает сосредоточиться. Lorem Ipsum используют потому, что тот обеспечивает более или менее стандартное заполнение шаблона, а также реальное распределение букв и пробелов в абзацах, которое не получается при простой дубликации \"Здесь ваш текст.. Здесь ваш текст.. Здесь ваш текст..\" Многие программы электронной вёрстки и редакторы HTML используют Lorem Ipsum в качестве текста по умолчанию, так что поиск по ключевым словам \"lorem ipsum\" сразу показывает, как много веб-страниц всё ещё дожидаются своего настоящего рождения. За прошедшие годы текст Lorem Ipsum получил много версий. Некоторые версии появились по ошибке, некоторые - намеренно (например, юмористические варианты).\n" +
    "\n" +
    "\n" +
    "Откуда он появился?\n" +
    "Многие думают, что Lorem Ipsum - взятый с потолка псевдо-латинский набор слов, но это не совсем так. Его корни уходят в один фрагмент классической латыни 45 года н.э., то есть более двух тысячелетий назад. Ричард МакКлинток, профессор латыни из колледжа Hampden-Sydney, штат Вирджиния, взял одно из самых странных слов в Lorem Ipsum, \"consectetur\", и занялся его поисками в классической латинской литературе. В результате он нашёл неоспоримый первоисточник Lorem Ipsum в разделах 1.10.32 и 1.10.33 книги \"de Finibus Bonorum et Malorum\" (\"О пределах добра и зла\"), написанной Цицероном в 45 году н.э. Этот трактат по теории этики был очень популярен в эпоху Возрождения. Первая строка Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", происходит от одной из строк в разделе 1.10.32\n" +
    "\n" +
    "Классический текст Lorem Ipsum, используемый с XVI века, приведён ниже. Также даны разделы 1.10.32 и 1.10.33 \"de Finibus Bonorum et Malorum\" Цицерона и их английский перевод, сделанный H. Rackham, 1914 год.\n" +
    "\n" +
    "Где его взять?\n" +
    "Есть много вариантов Lorem Ipsum, но большинство из них имеет не всегда приемлемые модификации, например, юмористические вставки или слова, которые даже отдалённо не напоминают латынь. Если вам нужен Lorem Ipsum для серьёзного проекта, вы наверняка не хотите какой-нибудь шутки, скрытой в середине абзаца. Также все другие известные генераторы Lorem Ipsum используют один и тот же текст, который они просто повторяют, пока не достигнут нужный объём. Это делает предлагаемый здесь генератор единственным настоящим Lorem Ipsum генератором. Он использует словарь из более чем 200 латинских слов, а также набор моделей предложений. В результате сгенерированный Lorem Ipsum выглядит правдоподобно, не имеет повторяющихся абзацей или \"невозможных\" слов."
).split(" ");

function randomInteger(min, max) {
    let rand = min + Math.random() * (max - min);
    return Math.floor(rand)
}

function* SequenceGenerator() {
    let i = 0;
    while (true) {
        yield i++;
    }
}

function createSequenceGenerator() {
    const sequenceGenerator = SequenceGenerator();
    return () => sequenceGenerator.next().value
}

function asyncTimeout(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}

/* example/TestItem.svelte generated by Svelte v3.38.2 */

function create_fragment$6(ctx) {
	let div;
	let t0;
	let t1;
	let t2;
	let t3;

	return {
		c() {
			div = element("div");
			t0 = text(/*uniqueKey*/ ctx[0]);
			t1 = text(" Item (");
			t2 = text(/*height*/ ctx[1]);
			t3 = text("px)");
			set_style(div, "height", /*height*/ ctx[1] + "px");
			attr(div, "class", "svelte-1wny9jt");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
			append(div, t2);
			append(div, t3);
		},
		p(ctx, [dirty]) {
			if (dirty & /*uniqueKey*/ 1) set_data(t0, /*uniqueKey*/ ctx[0]);
			if (dirty & /*height*/ 2) set_data(t2, /*height*/ ctx[1]);

			if (dirty & /*height*/ 2) {
				set_style(div, "height", /*height*/ ctx[1] + "px");
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { uniqueKey } = $$props;
	let { height } = $$props;

	$$self.$$set = $$props => {
		if ("uniqueKey" in $$props) $$invalidate(0, uniqueKey = $$props.uniqueKey);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
	};

	return [uniqueKey, height];
}

class TestItem extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { uniqueKey: 0, height: 1 });
	}
}

/* example/SimpleList.svelte generated by Svelte v3.38.2 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i][0];
	child_ctx[12] = list[i][1];
	return child_ctx;
}

// (33:4) <VirtualScroll             bind:this={list}             data={items}             key="uniqueKey"             let:data             on:bottom={() => addNotification("bottom")}             on:top={() => addNotification("top")}     >
function create_default_slot$4(ctx) {
	let testitem;
	let current;
	const testitem_spread_levels = [/*data*/ ctx[15]];
	let testitem_props = {};

	for (let i = 0; i < testitem_spread_levels.length; i += 1) {
		testitem_props = assign(testitem_props, testitem_spread_levels[i]);
	}

	testitem = new TestItem({ props: testitem_props });

	return {
		c() {
			create_component(testitem.$$.fragment);
		},
		m(target, anchor) {
			mount_component(testitem, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const testitem_changes = (dirty & /*data*/ 32768)
			? get_spread_update(testitem_spread_levels, [get_spread_object(/*data*/ ctx[15])])
			: {};

			testitem.$set(testitem_changes);
		},
		i(local) {
			if (current) return;
			transition_in(testitem.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(testitem.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(testitem, detaching);
		}
	};
}

// (41:8) 
function create_header_slot$4(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a header set via slot";
			attr(div, "slot", "header");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (45:8) 
function create_footer_slot$4(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a footer set via slot";
			attr(div, "slot", "footer");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (53:4) {#each Object.entries(notifications) as [id, action] (id)}
function create_each_block$2(key_1, ctx) {
	let div;
	let t0_value = /*action*/ ctx[12] + "";
	let t0;
	let t1;
	let rect;
	let stop_animation = noop;

	return {
		key: key_1,
		first: null,
		c() {
			div = element("div");
			t0 = text(t0_value);
			t1 = space();
			this.first = div;
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*notifications*/ 4 && t0_value !== (t0_value = /*action*/ ctx[12] + "")) set_data(t0, t0_value);
		},
		r() {
			rect = div.getBoundingClientRect();
		},
		f() {
			fix_position(div);
			stop_animation();
		},
		a() {
			stop_animation();
			stop_animation = create_animation(div, rect, flip, {});
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$5(ctx) {
	let div0;
	let virtualscroll;
	let t0;
	let button0;
	let t2;
	let button1;
	let t4;
	let div1;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let current;
	let mounted;
	let dispose;

	let virtualscroll_props = {
		data: /*items*/ ctx[0],
		key: "uniqueKey",
		$$slots: {
			footer: [
				create_footer_slot$4,
				({ data }) => ({ 15: data }),
				({ data }) => data ? 32768 : 0
			],
			header: [
				create_header_slot$4,
				({ data }) => ({ 15: data }),
				({ data }) => data ? 32768 : 0
			],
			default: [
				create_default_slot$4,
				({ data }) => ({ 15: data }),
				({ data }) => data ? 32768 : 0
			]
		},
		$$scope: { ctx }
	};

	virtualscroll = new VirtualScroll({ props: virtualscroll_props });
	/*virtualscroll_binding*/ ctx[4](virtualscroll);
	virtualscroll.$on("bottom", /*bottom_handler*/ ctx[5]);
	virtualscroll.$on("top", /*top_handler*/ ctx[6]);
	let each_value = Object.entries(/*notifications*/ ctx[2]);
	const get_key = ctx => /*id*/ ctx[11];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context$2(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
	}

	return {
		c() {
			div0 = element("div");
			create_component(virtualscroll.$$.fragment);
			t0 = space();
			button0 = element("button");
			button0.textContent = "To top";
			t2 = space();
			button1 = element("button");
			button1.textContent = "To bottom";
			t4 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "vs svelte-xjtu2t");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			mount_component(virtualscroll, div0, null);
			insert(target, t0, anchor);
			insert(target, button0, anchor);
			insert(target, t2, anchor);
			insert(target, button1, anchor);
			insert(target, t4, anchor);
			insert(target, div1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div1, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[7]),
					listen(button1, "click", function () {
						if (is_function(/*list*/ ctx[1].scrollToBottom)) /*list*/ ctx[1].scrollToBottom.apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			const virtualscroll_changes = {};
			if (dirty & /*items*/ 1) virtualscroll_changes.data = /*items*/ ctx[0];

			if (dirty & /*$$scope, data*/ 98304) {
				virtualscroll_changes.$$scope = { dirty, ctx };
			}

			virtualscroll.$set(virtualscroll_changes);

			if (dirty & /*Object, notifications*/ 4) {
				each_value = Object.entries(/*notifications*/ ctx[2]);
				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, fix_and_destroy_block, create_each_block$2, null, get_each_context$2);
				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
			}
		},
		i(local) {
			if (current) return;
			transition_in(virtualscroll.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(virtualscroll.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			/*virtualscroll_binding*/ ctx[4](null);
			destroy_component(virtualscroll);
			if (detaching) detach(t0);
			if (detaching) detach(button0);
			if (detaching) detach(t2);
			if (detaching) detach(button1);
			if (detaching) detach(t4);
			if (detaching) detach(div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	const getItemId = createSequenceGenerator();
	const getNotificationId = createSequenceGenerator();
	let items = [];
	addItems(1000);
	let list;
	let notifications = {};

	function addItems(count = 10) {
		let new_items = [];

		for (let i = 0; i < count; i++) new_items.push({
			uniqueKey: getItemId(),
			height: randomInteger(20, 260)
		});

		$$invalidate(0, items = [...items, ...new_items]);
	}

	function addNotification(e) {
		const id = getNotificationId();
		$$invalidate(2, notifications[id] = e, notifications);

		setTimeout(
			() => {
				delete notifications[id];
				$$invalidate(2, notifications);
			},
			5000
		);
	}

	function virtualscroll_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			list = $$value;
			$$invalidate(1, list);
		});
	}

	const bottom_handler = () => addNotification("bottom");
	const top_handler = () => addNotification("top");
	const click_handler = () => list.scrollToOffset(0);

	return [
		items,
		list,
		notifications,
		addNotification,
		virtualscroll_binding,
		bottom_handler,
		top_handler,
		click_handler
	];
}

class SimpleList extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
	}
}

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

/* example/SimpleListStore.svelte generated by Svelte v3.38.2 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[13] = list[i][0];
	child_ctx[14] = list[i][1];
	return child_ctx;
}

// (38:4) <VirtualScroll             bind:this={list}             data={$items}             key="uniqueKey"             let:data             on:bottom={() => addNotification("bottom")}             on:top={() => addNotification("top")}     >
function create_default_slot$3(ctx) {
	let testitem;
	let current;
	const testitem_spread_levels = [/*data*/ ctx[17]];
	let testitem_props = {};

	for (let i = 0; i < testitem_spread_levels.length; i += 1) {
		testitem_props = assign(testitem_props, testitem_spread_levels[i]);
	}

	testitem = new TestItem({ props: testitem_props });

	return {
		c() {
			create_component(testitem.$$.fragment);
		},
		m(target, anchor) {
			mount_component(testitem, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const testitem_changes = (dirty & /*data*/ 131072)
			? get_spread_update(testitem_spread_levels, [get_spread_object(/*data*/ ctx[17])])
			: {};

			testitem.$set(testitem_changes);
		},
		i(local) {
			if (current) return;
			transition_in(testitem.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(testitem.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(testitem, detaching);
		}
	};
}

// (46:8) 
function create_header_slot$3(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a header";
			attr(div, "slot", "header");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (50:8) 
function create_footer_slot$3(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a footer";
			attr(div, "slot", "footer");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (65:4) {#each Object.entries(notifications) as [id, action] (id)}
function create_each_block$1(key_1, ctx) {
	let div;
	let t0_value = /*action*/ ctx[14] + "";
	let t0;
	let t1;
	let rect;
	let stop_animation = noop;

	return {
		key: key_1,
		first: null,
		c() {
			div = element("div");
			t0 = text(t0_value);
			t1 = space();
			this.first = div;
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*notifications*/ 2 && t0_value !== (t0_value = /*action*/ ctx[14] + "")) set_data(t0, t0_value);
		},
		r() {
			rect = div.getBoundingClientRect();
		},
		f() {
			fix_position(div);
			stop_animation();
		},
		a() {
			stop_animation();
			stop_animation = create_animation(div, rect, flip, {});
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$4(ctx) {
	let div0;
	let virtualscroll;
	let t0;
	let button0;
	let t2;
	let button1;
	let t4;
	let button2;
	let t6;
	let button3;
	let t8;
	let div1;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let current;
	let mounted;
	let dispose;

	let virtualscroll_props = {
		data: /*$items*/ ctx[2],
		key: "uniqueKey",
		$$slots: {
			footer: [
				create_footer_slot$3,
				({ data }) => ({ 17: data }),
				({ data }) => data ? 131072 : 0
			],
			header: [
				create_header_slot$3,
				({ data }) => ({ 17: data }),
				({ data }) => data ? 131072 : 0
			],
			default: [
				create_default_slot$3,
				({ data }) => ({ 17: data }),
				({ data }) => data ? 131072 : 0
			]
		},
		$$scope: { ctx }
	};

	virtualscroll = new VirtualScroll({ props: virtualscroll_props });
	/*virtualscroll_binding*/ ctx[6](virtualscroll);
	virtualscroll.$on("bottom", /*bottom_handler*/ ctx[7]);
	virtualscroll.$on("top", /*top_handler*/ ctx[8]);
	let each_value = Object.entries(/*notifications*/ ctx[1]);
	const get_key = ctx => /*id*/ ctx[13];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context$1(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
	}

	return {
		c() {
			div0 = element("div");
			create_component(virtualscroll.$$.fragment);
			t0 = space();
			button0 = element("button");
			button0.textContent = "Add 10 to top";
			t2 = space();
			button1 = element("button");
			button1.textContent = "Add 10 to bottom";
			t4 = space();
			button2 = element("button");
			button2.textContent = "To bottom";
			t6 = space();
			button3 = element("button");
			button3.textContent = "Add 1 and scroll to bottom";
			t8 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "vs svelte-129zz9d");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			mount_component(virtualscroll, div0, null);
			insert(target, t0, anchor);
			insert(target, button0, anchor);
			insert(target, t2, anchor);
			insert(target, button1, anchor);
			insert(target, t4, anchor);
			insert(target, button2, anchor);
			insert(target, t6, anchor);
			insert(target, button3, anchor);
			insert(target, t8, anchor);
			insert(target, div1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div1, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*addItems*/ ctx[4]),
					listen(button1, "click", /*click_handler*/ ctx[9]),
					listen(button2, "click", function () {
						if (is_function(/*list*/ ctx[0].scrollToBottom)) /*list*/ ctx[0].scrollToBottom.apply(this, arguments);
					}),
					listen(button3, "click", /*click_handler_1*/ ctx[10])
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			const virtualscroll_changes = {};
			if (dirty & /*$items*/ 4) virtualscroll_changes.data = /*$items*/ ctx[2];

			if (dirty & /*$$scope, data*/ 393216) {
				virtualscroll_changes.$$scope = { dirty, ctx };
			}

			virtualscroll.$set(virtualscroll_changes);

			if (dirty & /*Object, notifications*/ 2) {
				each_value = Object.entries(/*notifications*/ ctx[1]);
				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, fix_and_destroy_block, create_each_block$1, null, get_each_context$1);
				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
			}
		},
		i(local) {
			if (current) return;
			transition_in(virtualscroll.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(virtualscroll.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			/*virtualscroll_binding*/ ctx[6](null);
			destroy_component(virtualscroll);
			if (detaching) detach(t0);
			if (detaching) detach(button0);
			if (detaching) detach(t2);
			if (detaching) detach(button1);
			if (detaching) detach(t4);
			if (detaching) detach(button2);
			if (detaching) detach(t6);
			if (detaching) detach(button3);
			if (detaching) detach(t8);
			if (detaching) detach(div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let $items;
	const getItemId = createSequenceGenerator();
	const getNotificationId = createSequenceGenerator();
	let items = writable([]);
	component_subscribe($$self, items, value => $$invalidate(2, $items = value));
	addItems(true, 1000);
	let list;
	let notifications = {};

	function addItems(top = true, count = 10) {
		let new_items = [];

		for (let i = 0; i < count; i++) new_items.push({
			uniqueKey: getItemId(),
			height: randomInteger(20, 60)
		});

		if (top) set_store_value(items, $items = [...new_items, ...$items], $items); else set_store_value(items, $items = [...$items, ...new_items], $items);
	}

	function addNotification(e) {
		const id = getNotificationId();
		$$invalidate(1, notifications[id] = e, notifications);

		setTimeout(
			() => {
				delete notifications[id];
				$$invalidate(1, notifications);
			},
			5000
		);
	}

	function virtualscroll_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			list = $$value;
			$$invalidate(0, list);
		});
	}

	const bottom_handler = () => addNotification("bottom");
	const top_handler = () => addNotification("top");
	const click_handler = () => addItems(false);

	const click_handler_1 = async () => {
		addItems(false, 1);
		await tick();
		list.scrollToBottom();
	};

	return [
		list,
		notifications,
		$items,
		items,
		addItems,
		addNotification,
		virtualscroll_binding,
		bottom_handler,
		top_handler,
		click_handler,
		click_handler_1
	];
}

class SimpleListStore extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
	}
}

/* example/InfiniteList.svelte generated by Svelte v3.38.2 */

function create_default_slot$2(ctx) {
	let testitem;
	let current;
	const testitem_spread_levels = [/*data*/ ctx[10]];
	let testitem_props = {};

	for (let i = 0; i < testitem_spread_levels.length; i += 1) {
		testitem_props = assign(testitem_props, testitem_spread_levels[i]);
	}

	testitem = new TestItem({ props: testitem_props });

	return {
		c() {
			create_component(testitem.$$.fragment);
		},
		m(target, anchor) {
			mount_component(testitem, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const testitem_changes = (dirty & /*data*/ 1024)
			? get_spread_update(testitem_spread_levels, [get_spread_object(/*data*/ ctx[10])])
			: {};

			testitem.$set(testitem_changes);
		},
		i(local) {
			if (current) return;
			transition_in(testitem.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(testitem.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(testitem, detaching);
		}
	};
}

// (62:8) 
function create_header_slot$2(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "Loading...";
			attr(div, "slot", "header");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (66:8) 
function create_footer_slot$2(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "loading...";
			attr(div, "slot", "footer");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$3(ctx) {
	let div;
	let virtualscroll;
	let t0;
	let button0;
	let t2;
	let button1;
	let current;
	let mounted;
	let dispose;

	let virtualscroll_props = {
		data: /*items*/ ctx[0],
		key: "uniqueKey",
		start: 30,
		$$slots: {
			footer: [
				create_footer_slot$2,
				({ data }) => ({ 10: data }),
				({ data }) => data ? 1024 : 0
			],
			header: [
				create_header_slot$2,
				({ data }) => ({ 10: data }),
				({ data }) => data ? 1024 : 0
			],
			default: [
				create_default_slot$2,
				({ data }) => ({ 10: data }),
				({ data }) => data ? 1024 : 0
			]
		},
		$$scope: { ctx }
	};

	virtualscroll = new VirtualScroll({ props: virtualscroll_props });
	/*virtualscroll_binding*/ ctx[3](virtualscroll);
	virtualscroll.$on("bottom", /*bottom_handler*/ ctx[4]);
	virtualscroll.$on("top", /*top_handler*/ ctx[5]);

	return {
		c() {
			div = element("div");
			create_component(virtualscroll.$$.fragment);
			t0 = space();
			button0 = element("button");
			button0.textContent = "To Top";
			t2 = space();
			button1 = element("button");
			button1.textContent = "To bottom";
			attr(div, "class", "vs svelte-129zz9d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(virtualscroll, div, null);
			insert(target, t0, anchor);
			insert(target, button0, anchor);
			insert(target, t2, anchor);
			insert(target, button1, anchor);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[6]),
					listen(button1, "click", function () {
						if (is_function(/*list*/ ctx[1].scrollToBottom)) /*list*/ ctx[1].scrollToBottom.apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			const virtualscroll_changes = {};
			if (dirty & /*items*/ 1) virtualscroll_changes.data = /*items*/ ctx[0];

			if (dirty & /*$$scope, data*/ 3072) {
				virtualscroll_changes.$$scope = { dirty, ctx };
			}

			virtualscroll.$set(virtualscroll_changes);
		},
		i(local) {
			if (current) return;
			transition_in(virtualscroll.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(virtualscroll.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			/*virtualscroll_binding*/ ctx[3](null);
			destroy_component(virtualscroll);
			if (detaching) detach(t0);
			if (detaching) detach(button0);
			if (detaching) detach(t2);
			if (detaching) detach(button1);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	const getItemId = createSequenceGenerator();
	let loading = false;
	let items = itemsFactory(70);
	let list;

	function itemsFactory(count = 10) {
		let new_items = [];

		for (let i = 0; i < count; i++) new_items.push({
			uniqueKey: getItemId(),
			height: randomInteger(20, 60)
		});

		return new_items;
	}

	async function asyncAddItems(top = true, count = 10) {
		if (loading) return;
		loading = true;
		await asyncTimeout(1000);
		let new_items = itemsFactory(count);

		if (top) {
			$$invalidate(0, items = [...new_items, ...items]);

			// to save position on adding items to top we need to calculate
			// new top offset based on added items
			//
			// it works ONLY if newly added items was rendered
			tick().then(() => {
				const sids = new_items.map(i => i.uniqueKey);
				const offset = sids.reduce((previousValue, currentSid) => previousValue + list.getSize(currentSid), 0);
				list.scrollToOffset(offset);
			});
		} else {
			$$invalidate(0, items = [...items, ...new_items]);

			// timeout needs because sometimes when you scroll down `scroll` event fires twice
			// and changes list.virtual.direction from BEHIND to FRONT
			// maybe there is a better solution
			setTimeout(() => list.scrollToOffset(list.getOffset() + 1), 3);
		}

		loading = false;
	}

	function virtualscroll_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			list = $$value;
			$$invalidate(1, list);
		});
	}

	const bottom_handler = () => asyncAddItems(false);
	const top_handler = () => asyncAddItems();
	const click_handler = () => list.scrollToOffset(0);

	return [
		items,
		list,
		asyncAddItems,
		virtualscroll_binding,
		bottom_handler,
		top_handler,
		click_handler
	];
}

class InfiniteList extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
	}
}

/* example/PageList.svelte generated by Svelte v3.38.2 */

function create_default_slot$1(ctx) {
	let testitem;
	let current;
	const testitem_spread_levels = [/*data*/ ctx[6]];
	let testitem_props = {};

	for (let i = 0; i < testitem_spread_levels.length; i += 1) {
		testitem_props = assign(testitem_props, testitem_spread_levels[i]);
	}

	testitem = new TestItem({ props: testitem_props });

	return {
		c() {
			create_component(testitem.$$.fragment);
		},
		m(target, anchor) {
			mount_component(testitem, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const testitem_changes = (dirty & /*data*/ 64)
			? get_spread_update(testitem_spread_levels, [get_spread_object(/*data*/ ctx[6])])
			: {};

			testitem.$set(testitem_changes);
		},
		i(local) {
			if (current) return;
			transition_in(testitem.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(testitem.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(testitem, detaching);
		}
	};
}

// (35:8) 
function create_header_slot$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a header";
			attr(div, "slot", "header");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (39:8) 
function create_footer_slot$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a footer";
			attr(div, "slot", "footer");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$2(ctx) {
	let div0;
	let button0;
	let t1;
	let button1;
	let t3;
	let div1;
	let virtualscroll;
	let current;
	let mounted;
	let dispose;

	let virtualscroll_props = {
		data: /*items*/ ctx[0],
		key: "uniqueKey",
		pageMode: true,
		$$slots: {
			footer: [
				create_footer_slot$1,
				({ data }) => ({ 6: data }),
				({ data }) => data ? 64 : 0
			],
			header: [
				create_header_slot$1,
				({ data }) => ({ 6: data }),
				({ data }) => data ? 64 : 0
			],
			default: [
				create_default_slot$1,
				({ data }) => ({ 6: data }),
				({ data }) => data ? 64 : 0
			]
		},
		$$scope: { ctx }
	};

	virtualscroll = new VirtualScroll({ props: virtualscroll_props });
	/*virtualscroll_binding*/ ctx[3](virtualscroll);

	return {
		c() {
			div0 = element("div");
			button0 = element("button");
			button0.textContent = "To top";
			t1 = space();
			button1 = element("button");
			button1.textContent = "To bottom";
			t3 = space();
			div1 = element("div");
			create_component(virtualscroll.$$.fragment);
			attr(div0, "class", "overflow-buttons svelte-vwjlm9");
			attr(div1, "class", "vs");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, button0);
			append(div0, t1);
			append(div0, button1);
			insert(target, t3, anchor);
			insert(target, div1, anchor);
			mount_component(virtualscroll, div1, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[2]),
					listen(button1, "click", function () {
						if (is_function(/*list*/ ctx[1].scrollToBottom)) /*list*/ ctx[1].scrollToBottom.apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			const virtualscroll_changes = {};
			if (dirty & /*items*/ 1) virtualscroll_changes.data = /*items*/ ctx[0];

			if (dirty & /*$$scope, data*/ 192) {
				virtualscroll_changes.$$scope = { dirty, ctx };
			}

			virtualscroll.$set(virtualscroll_changes);
		},
		i(local) {
			if (current) return;
			transition_in(virtualscroll.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(virtualscroll.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			if (detaching) detach(t3);
			if (detaching) detach(div1);
			/*virtualscroll_binding*/ ctx[3](null);
			destroy_component(virtualscroll);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	const getItemId = createSequenceGenerator();
	let items = [];
	addItems(true, 1000);
	let list;

	function addItems(top = true, count = 10) {
		let new_items = [];

		for (let i = 0; i < count; i++) new_items.push({
			uniqueKey: getItemId(),
			height: randomInteger(20, 60)
		});

		if (top) $$invalidate(0, items = [...new_items, ...items]); else $$invalidate(0, items = [...items, ...new_items]);
	}

	const click_handler = () => list.scrollToOffset(0);

	function virtualscroll_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			list = $$value;
			$$invalidate(1, list);
		});
	}

	return [items, list, click_handler, virtualscroll_binding];
}

class PageList extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
	}
}

/* example/ChangeableData.svelte generated by Svelte v3.38.2 */

function create_default_slot(ctx) {
	let testitem;
	let current;
	const testitem_spread_levels = [/*data*/ ctx[8]];
	let testitem_props = {};

	for (let i = 0; i < testitem_spread_levels.length; i += 1) {
		testitem_props = assign(testitem_props, testitem_spread_levels[i]);
	}

	testitem = new TestItem({ props: testitem_props });

	return {
		c() {
			create_component(testitem.$$.fragment);
		},
		m(target, anchor) {
			mount_component(testitem, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const testitem_changes = (dirty & /*data*/ 256)
			? get_spread_update(testitem_spread_levels, [get_spread_object(/*data*/ ctx[8])])
			: {};

			testitem.$set(testitem_changes);
		},
		i(local) {
			if (current) return;
			transition_in(testitem.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(testitem.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(testitem, detaching);
		}
	};
}

// (31:8) 
function create_header_slot(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a header";
			attr(div, "slot", "header");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (35:8) 
function create_footer_slot(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "This is a footer";
			attr(div, "slot", "footer");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment$1(ctx) {
	let div;
	let virtualscroll;
	let t0;
	let button0;
	let t2;
	let button1;
	let t4;
	let button2;
	let t6;
	let button3;
	let t8;
	let button4;
	let current;
	let mounted;
	let dispose;

	let virtualscroll_props = {
		data: /*items*/ ctx[0],
		key: "uniqueKey",
		$$slots: {
			footer: [
				create_footer_slot,
				({ data }) => ({ 8: data }),
				({ data }) => data ? 256 : 0
			],
			header: [
				create_header_slot,
				({ data }) => ({ 8: data }),
				({ data }) => data ? 256 : 0
			],
			default: [
				create_default_slot,
				({ data }) => ({ 8: data }),
				({ data }) => data ? 256 : 0
			]
		},
		$$scope: { ctx }
	};

	virtualscroll = new VirtualScroll({ props: virtualscroll_props });
	/*virtualscroll_binding*/ ctx[3](virtualscroll);

	return {
		c() {
			div = element("div");
			create_component(virtualscroll.$$.fragment);
			t0 = space();
			button0 = element("button");
			button0.textContent = "Add 10 to top";
			t2 = space();
			button1 = element("button");
			button1.textContent = "Add 10 to bottom";
			t4 = space();
			button2 = element("button");
			button2.textContent = "To bottom";
			t6 = space();
			button3 = element("button");
			button3.textContent = "Add 1 and scroll to bottom";
			t8 = space();
			button4 = element("button");
			button4.textContent = "Random height for 15 item";
			attr(div, "class", "vs svelte-129zz9d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(virtualscroll, div, null);
			insert(target, t0, anchor);
			insert(target, button0, anchor);
			insert(target, t2, anchor);
			insert(target, button1, anchor);
			insert(target, t4, anchor);
			insert(target, button2, anchor);
			insert(target, t6, anchor);
			insert(target, button3, anchor);
			insert(target, t8, anchor);
			insert(target, button4, anchor);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*addItems*/ ctx[2]),
					listen(button1, "click", /*click_handler*/ ctx[4]),
					listen(button2, "click", function () {
						if (is_function(/*list*/ ctx[1].scrollToBottom)) /*list*/ ctx[1].scrollToBottom.apply(this, arguments);
					}),
					listen(button3, "click", /*click_handler_1*/ ctx[5]),
					listen(button4, "click", /*click_handler_2*/ ctx[6])
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			const virtualscroll_changes = {};
			if (dirty & /*items*/ 1) virtualscroll_changes.data = /*items*/ ctx[0];

			if (dirty & /*$$scope, data*/ 768) {
				virtualscroll_changes.$$scope = { dirty, ctx };
			}

			virtualscroll.$set(virtualscroll_changes);
		},
		i(local) {
			if (current) return;
			transition_in(virtualscroll.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(virtualscroll.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			/*virtualscroll_binding*/ ctx[3](null);
			destroy_component(virtualscroll);
			if (detaching) detach(t0);
			if (detaching) detach(button0);
			if (detaching) detach(t2);
			if (detaching) detach(button1);
			if (detaching) detach(t4);
			if (detaching) detach(button2);
			if (detaching) detach(t6);
			if (detaching) detach(button3);
			if (detaching) detach(t8);
			if (detaching) detach(button4);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	const getItemId = createSequenceGenerator();
	let items = [];
	addItems(true, 100);
	let list;

	function addItems(top = true, count = 10) {
		let new_items = [];

		for (let i = 0; i < count; i++) new_items.push({
			uniqueKey: getItemId(),
			height: randomInteger(20, 60)
		});

		if (top) $$invalidate(0, items = [...new_items, ...items]); else $$invalidate(0, items = [...items, ...new_items]);
	}

	function virtualscroll_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			list = $$value;
			$$invalidate(1, list);
		});
	}

	const click_handler = () => addItems(false);

	const click_handler_1 = async () => {
		addItems(false, 1);
		await tick();
		list.scrollToBottom();
	};

	const click_handler_2 = () => $$invalidate(0, items[15].height = randomInteger(10, 150), items);

	return [
		items,
		list,
		addItems,
		virtualscroll_binding,
		click_handler,
		click_handler_1,
		click_handler_2
	];
}

class ChangeableData extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
	}
}

/* example/App.svelte generated by Svelte v3.38.2 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[3] = list[i];
	return child_ctx;
}

// (23:8) {#each pages as page}
function create_each_block(ctx) {
	let span;
	let t_value = /*page*/ ctx[3].name + "";
	let t;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[2](/*page*/ ctx[3]);
	}

	return {
		c() {
			span = element("span");
			t = text(t_value);
			attr(span, "class", "page-selector svelte-1k5p4wj");
			toggle_class(span, "active", /*currentPage*/ ctx[0].name === /*page*/ ctx[3].name);
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);

			if (!mounted) {
				dispose = listen(span, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*currentPage, pages*/ 3) {
				toggle_class(span, "active", /*currentPage*/ ctx[0].name === /*page*/ ctx[3].name);
			}
		},
		d(detaching) {
			if (detaching) detach(span);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let main;
	let h1;
	let t1;
	let div;
	let t2;
	let a;
	let t4;
	let switch_instance;
	let current;
	let each_value = /*pages*/ ctx[1];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	var switch_value = /*currentPage*/ ctx[0].component;

	function switch_props(ctx) {
		return {};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props());
	}

	return {
		c() {
			main = element("main");
			h1 = element("h1");
			h1.textContent = "svelte-virtual-scroll-list example";
			t1 = space();
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t2 = space();
			a = element("a");
			a.textContent = "Source";
			t4 = space();
			if (switch_instance) create_component(switch_instance.$$.fragment);
			attr(a, "class", "source svelte-1k5p4wj");
			attr(a, "href", "https://github.com/v1ack/svelte-virtual-scroll-list/tree/master/example");
			attr(div, "class", "page-selector-container svelte-1k5p4wj");
			attr(main, "class", "svelte-1k5p4wj");
		},
		m(target, anchor) {
			insert(target, main, anchor);
			append(main, h1);
			append(main, t1);
			append(main, div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}

			append(div, t2);
			append(div, a);
			append(main, t4);

			if (switch_instance) {
				mount_component(switch_instance, main, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (dirty & /*currentPage, pages*/ 3) {
				each_value = /*pages*/ ctx[1];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, t2);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (switch_value !== (switch_value = /*currentPage*/ ctx[0].component)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props());
					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, main, null);
				} else {
					switch_instance = null;
				}
			}
		},
		i(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(main);
			destroy_each(each_blocks, detaching);
			if (switch_instance) destroy_component(switch_instance);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	const pages = [
		{
			name: "Simple list",
			component: SimpleList
		},
		{
			name: "Infinite list",
			component: InfiniteList
		},
		{ name: "Page mode", component: PageList },
		{
			name: "ChangeableData",
			component: ChangeableData
		},
		{
			name: "SimpleListStore",
			component: SimpleListStore
		}
	];

	let currentPage = pages[0];
	const click_handler = page => $$invalidate(0, currentPage = page);
	return [currentPage, pages, click_handler];
}

class App extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

var main = new App({target: document.body});

export default main;
//# sourceMappingURL=bundle.js.map
