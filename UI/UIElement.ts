import {UIEventSource} from "../Logic/UIEventSource";

export abstract class UIElement extends UIEventSource<string>{
    
    private static nextId: number = 0;

    public readonly id: string;
    public readonly _source: UIEventSource<any>;
    public clss : string = ""
    
    private _hideIfEmpty = false;
    
    /**
     * In the 'deploy'-step, some code needs to be run by ts-node.
     * However, ts-node crashes when it sees 'document'. When running from console, we flag this and disable all code where document is needed.
     * This is a workaround and yet another hack
     */
    public static runningFromConsole = false;

    protected constructor(source: UIEventSource<any>) {
        super("");
        this.id = "ui-element-" + UIElement.nextId;
        this._source = source;
        UIElement.nextId++;
        this.ListenTo(source);
    }


    public ListenTo(source: UIEventSource<any>) {
        if (source === undefined) {
            return this;
        }
        const self = this;
        source.addCallback(() => {
            self.Update();
        })
        return this;
    }

    private _onClick: () => void;

    public onClick(f: (() => void)) {
        this._onClick = f;
        this.Update();
        return this;
    }
    
    Update(): void {
        if(UIElement.runningFromConsole){
            return;
        }
        
        let element = document.getElementById(this.id);
        if (element === undefined || element === null) {
            // The element is not painted
            return;
        }
        this.setData(this.InnerRender());
        element.innerHTML = this.data;
        if (this._hideIfEmpty) {
            if (element.innerHTML === "") {
                element.parentElement.style.display = "none";
            } else {
                element.parentElement.style.display = undefined;
            }
        }

        if (this._onClick !== undefined) {
            const self = this;
            element.onclick = (e) => {
                // @ts-ignore
                if(e.consumed){
                    return;
                }
                self._onClick();
                // @ts-ignore
                e.consumed = true;
            }
            element.style.pointerEvents = "all";
            element.style.cursor = "pointer";
        }

        this.InnerUpdate(element);

        for (const i in this) {
            const child = this[i];
            if (child instanceof UIElement) {
                child.Update();
            } else if (child instanceof Array) {
                for (const ch of child) {
                    if (ch instanceof UIElement) {
                        ch.Update();
                    }
                }
            }
        }
    }
    
    HideOnEmpty(hide : boolean){
        this._hideIfEmpty = hide;
        this.Update();
        return this;
    }
    
    // Called after the HTML has been replaced. Can be used for css tricks
   protected InnerUpdate(htmlElement: HTMLElement) {
   }

    Render(): string {
        return `<span class='uielement ${this.clss}' id='${this.id}'>${this.InnerRender()}</span>`
    }

    AttachTo(divId: string) {
        let element = document.getElementById(divId);
        if (element === null) {
            throw "SEVERE: could not attach UIElement to " + divId;
        }
        element.innerHTML = this.Render();
        this.Update();
        return this;
    }

    public abstract InnerRender(): string;

    public Activate(): void {
        for (const i in this) {
            const child = this[i];
            if (child instanceof UIElement) {
                child.Activate();
            } else if (child instanceof Array) {
                for (const ch of child) {
                    if (ch instanceof UIElement) {
                        ch.Activate();
                    }
                }
            }
        }
    };

    public IsEmpty(): boolean {
        return this.InnerRender() === "";
    }

    public SetClass(clss: string): UIElement {
        this.clss = clss;
        return this;
    }

}



