import {UIElement} from "./UIElement";
import {VerticalCombine} from "./Base/VerticalCombine";
import Translations from "./i18n/Translations";
import {AllKnownLayouts} from "../Customizations/AllKnownLayouts";
import Combine from "./Base/Combine";
import {SubtleButton} from "./Base/SubtleButton";
import {State} from "../State";
import {CustomLayout} from "../Logic/CustomLayers";
import {VariableUiElement} from "./Base/VariableUIElement";


export class MoreScreen extends UIElement {

    constructor() {
        super(State.state.locationControl);
        this.ListenTo(State.state.osmConnection.userDetails);
    }

    InnerRender(): string {

        const tr = Translations.t.general.morescreen;

        const els: UIElement[] = []

        els.push(new VariableUiElement(
            State.state.osmConnection.userDetails.map(userDetails => {
                if (userDetails.csCount < State.userJourney.themeGeneratorUnlock) {
                    return tr.requestATheme.Render();
                }
                return new SubtleButton("./assets/pencil.svg", tr.createYourOwnTheme, {
                    url: "https://pietervdvn.github.io/MapComplete/customGenerator.html",
                    newTab: false
                }).Render();
            })
        ));

        els.push(new VariableUiElement(
            State.state.osmConnection.userDetails.map(userDetails => {
                if (userDetails.csCount < State.userJourney.customLayoutUnlock) {
                    return "";
                }
                return new SubtleButton("./assets/star.svg",
                    new Combine([
                        "<b>",
                        Translations.t.favourite.title,
                        "</b>",
                        "<br>", Translations.t.favourite.description]), {
                        url: "https://pietervdvn.github.io/MapComplete/personal.html",
                        newTab: false
                    }).Render();
            })
        ));


        for (const k in AllKnownLayouts.allSets) {
            const layout = AllKnownLayouts.allSets[k]
            if (layout.hideFromOverview && State.state.osmConnection.userDetails.data.name !== "Pieter Vander Vennet") {
                continue
            }
            if (layout.name === State.state.layoutToUse.data.name) {
                continue;
            }

            if (layout.name === CustomLayout.NAME) {
                continue;
            }

            const currentLocation = State.state.locationControl.data;
            let linkText =
                `./${layout.name}.html?z=${currentLocation.zoom}&lat=${currentLocation.lat}&lon=${currentLocation.lon}`

            if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
                linkText = `./index.html?layout=${layout.name}&z=${currentLocation.zoom}&lat=${currentLocation.lat}&lon=${currentLocation.lon}`
            }

            let description = Translations.W(layout.description);
            if (description !== undefined) {
                description = new Combine(["<br/>", description]);
            }
            const link =
                new SubtleButton(layout.icon,
                    new Combine([
                        "<b>",
                        Translations.W(layout.title),
                        "</b>",
                        description ?? "",
                    ]), {url: linkText, newTab: false});

            els.push(link)
        }


        return new VerticalCombine([
            tr.intro,
            new VerticalCombine(els),
            tr.streetcomplete
        ]).Render();
    }

}