import {
    commands,
    ConfigurationChangeEvent,
    ConfigurationTarget,
    Disposable,
    Event,
    EventEmitter,
    MessageItem,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    TreeViewExpansionEvent,
    TreeViewVisibilityChangeEvent,
    window
} from 'vscode';
import { configuration } from '../configuration';
import { Container } from '../container';
import { Logger } from '../logger';
import { Debug, Functions, Log, Strings } from '../system';
import { FavoritesView } from './favoritesView';
import { GroupsView } from './groupsView';
import {
    nodeSupportsPaging,
    PageableViewNode,
    ViewNode
} from './nodes/viewNode';
import { WorkspacesView } from './workspacesView';

export type View = FavoritesView | GroupsView | WorkspacesView;

export interface TreeViewNodeStateChangeEvent<T>
    extends TreeViewExpansionEvent<T> {
    state: TreeItemCollapsibleState;
}

export abstract class ViewBase<TRoot extends ViewNode<View>>
    implements TreeDataProvider<ViewNode>, Disposable {
    protected _onDidChangeTreeData = new EventEmitter<ViewNode>();
    get onDidChangeTreeData(): Event<ViewNode> {
        return this._onDidChangeTreeData.event;
    }

    private _onDidChangeVisibility = new EventEmitter<
        TreeViewVisibilityChangeEvent
    >();
    get onDidChangeVisibility(): Event<TreeViewVisibilityChangeEvent> {
        return this._onDidChangeVisibility.event;
    }

    private _onDidChangeNodeState = new EventEmitter<
        TreeViewNodeStateChangeEvent<ViewNode>
    >();
    get onDidChangeNodeState(): Event<TreeViewNodeStateChangeEvent<ViewNode>> {
        return this._onDidChangeNodeState.event;
    }

    protected _disposable: Disposable | undefined;
    private readonly _lastMaxCounts = new Map<string, number | undefined>();
    protected _root: TRoot | undefined;
    protected _tree: TreeView<ViewNode> | undefined;

    constructor(public readonly id: string, public readonly name: string) {
        if (Container.isDebugging) {
            const fn = this.getTreeItem;
            this.getTreeItem = async function(
                this: ViewBase<TRoot>,
                node: ViewNode
            ) {
                const item = await fn.apply(this, [node]);

                item.tooltip = `${item.tooltip ||
                    item.label}\n\nDBG: ${node.toString()}, ${
                    item.contextValue
                }`;
                return item;
            };
        }

        this.registerCommands();

        Container.context.subscriptions.push(
            configuration.onDidChange(this.onConfigurationChanged, this)
        );
        setImmediate(() =>
            this.onConfigurationChanged(configuration.initializingChangeEvent)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    getQualifiedCommand(command: string) {
        return `${this.id}.${command}`;
    }

    protected abstract get location(): string | undefined;

    protected abstract getRoot(): TRoot;
    protected abstract registerCommands(): void;
    protected abstract onConfigurationChanged(
        e: ConfigurationChangeEvent
    ): void;

    protected initialize(
        container?: string,
        options: { showCollapseAll?: boolean } = {}
    ) {
        if (this._disposable) {
            this._disposable.dispose();
            this._onDidChangeTreeData = new EventEmitter<ViewNode>();
        }

        this._tree = window.createTreeView(
            `${this.id}${container ? `:${container}` : ''}`,
            {
                ...options,
                treeDataProvider: this
            }
        );

        this._disposable = Disposable.from(
            this._tree,
            this._tree.onDidChangeVisibility(
                Functions.debounce(this.onVisibilityChanged, 250),
                this
            ),
            this._tree.onDidCollapseElement(this.onElementCollapsed, this),
            this._tree.onDidExpandElement(this.onElementExpanded, this)
        );
    }

    protected ensureRoot() {
        if (this._root === undefined) {
            this._root = this.getRoot();
        }

        return this._root;
    }

    getChildren(node?: ViewNode): ViewNode[] | Promise<ViewNode[]> {
        if (node !== undefined) return node.getChildren();

        const root = this.ensureRoot();
        return root.getChildren();
    }

    getParent(node: ViewNode): ViewNode | undefined {
        return node.getParent();
    }

    getTreeItem(node: ViewNode): TreeItem | Promise<TreeItem> {
        return node.getTreeItem();
    }

    protected onElementCollapsed(e: TreeViewExpansionEvent<ViewNode>) {
        // Clear any last max count if the node was collapsed
        if (nodeSupportsPaging(e.element)) {
            this.resetNodeLastMaxCount(e.element);
        }

        this._onDidChangeNodeState.fire({
            ...e,
            state: TreeItemCollapsibleState.Collapsed
        });
    }

    protected onElementExpanded(e: TreeViewExpansionEvent<ViewNode>) {
        this._onDidChangeNodeState.fire({
            ...e,
            state: TreeItemCollapsibleState.Expanded
        });
    }

    protected onVisibilityChanged(e: TreeViewVisibilityChangeEvent) {
        this._onDidChangeVisibility.fire(e);
    }

    get selection(): ViewNode[] {
        if (this._tree === undefined || this._root === undefined) return [];

        return this._tree.selection;
    }

    get visible(): boolean {
        return this._tree !== undefined ? this._tree.visible : false;
    }

    @Debug()
    async refresh(reset: boolean = false) {
        if (this._root !== undefined && this._root.refresh !== undefined) {
            await this._root.refresh(reset);
        }

        this.triggerNodeChange();
    }

    @Debug({
        args: { 0: (n: ViewNode) => n.toString() }
    })
    async refreshNode(node: ViewNode, reset: boolean = false) {
        if (node.refresh !== undefined) {
            const cancel = await node.refresh(reset);
            if (cancel === true) return;
        }

        this.triggerNodeChange(node);
    }

    @Debug({
        args: { 0: (n: ViewNode) => n.toString() }
    })
    getNodeLastMaxCount(node: PageableViewNode) {
        return node.id === undefined
            ? undefined
            : this._lastMaxCounts.get(node.id);
    }

    @Debug({
        args: { 0: (n: ViewNode) => n.toString() }
    })
    resetNodeLastMaxCount(node: PageableViewNode) {
        if (node.id === undefined || !node.rememberLastMaxCount) return;

        this._lastMaxCounts.delete(node.id);
    }

    @Debug({
        args: { 0: (n: ViewNode) => (n != null ? n.toString() : '') }
    })
    triggerNodeChange(node?: ViewNode) {
        // Since the root node won't actually refresh, force everything
        this._onDidChangeTreeData.fire(
            node !== undefined && node !== this._root ? node : undefined
        );
    }
}
