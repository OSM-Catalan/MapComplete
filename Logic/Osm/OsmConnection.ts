// @ts-ignore
import osmAuth from "osm-auth";
import {UIEventSource} from "../UIEventSource";
import {CustomLayersState} from "../CustomLayersState";
import {State} from "../../State";

export class UserDetails {

    public loggedIn = false;
    public name = "Not logged in";
    public csCount = 0;
    public img: string;
    public unreadMessages = 0;
    public totalMessages = 0;
    public dryRun: boolean;
    home: { lon: number; lat: number };
}

export class OsmConnection {

    public auth;
    public userDetails: UIEventSource<UserDetails>;
    private _dryRun: boolean;

    constructor(dryRun: boolean, oauth_token: UIEventSource<string>, singlePage: boolean = true) {

        let pwaStandAloneMode = false;
        try {
            if (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches) {
                pwaStandAloneMode = true;
            }
        } catch (e) {
            console.warn("Detecting standalone mode failed", e, ". Assuming in browser and not worrying furhter")
        }
        
        const iframeMode = window !== window.top;


        if ( iframeMode || pwaStandAloneMode || !singlePage) {
            // In standalone mode, we DON'T use single page login, as 'redirecting' opens a new window anyway...
            // Same for an iframe...
            this.auth = new osmAuth({
                oauth_consumer_key: 'hivV7ec2o49Two8g9h8Is1VIiVOgxQ1iYexCbvem',
                oauth_secret: 'wDBRTCem0vxD7txrg1y6p5r8nvmz8tAhET7zDASI',
                singlepage: false,
                auto: true
            });
        } else {

            this.auth = new osmAuth({
                oauth_consumer_key: 'hivV7ec2o49Two8g9h8Is1VIiVOgxQ1iYexCbvem',
                oauth_secret: 'wDBRTCem0vxD7txrg1y6p5r8nvmz8tAhET7zDASI',
                singlepage: true,
                landing: window.location.href,
                auto: true
            });
        }


        this.userDetails = new UIEventSource<UserDetails>(new UserDetails());
        this.userDetails.data.dryRun = dryRun;
        this._dryRun = dryRun;


        if (oauth_token.data !== undefined) {
            console.log(oauth_token.data)
            const self = this;
            this.auth.bootstrapToken(oauth_token.data, 
                (x) => {
                    console.log("Called back: ", x)
                    self.AttemptLogin();
                }, this.auth);
            
            oauth_token.setData(undefined);
           
        }
        if (this.auth.authenticated()) {
            this.AttemptLogin(); // Also updates the user badge
        } else {
            console.log("Not authenticated");
        }


        if (dryRun) {
            console.log("DRYRUN ENABLED");
        }

       
    }

    public LogOut() {
        this.auth.logout();
        this.userDetails.data.loggedIn = false;
        this.userDetails.ping();
        console.log("Logged out")
    }

    public AttemptLogin() {
        const self = this;
        this.auth.xhr({
            method: 'GET',
            path: '/api/0.6/user/details'
        }, function (err, details) {
            if(err != null){
                console.log(err);
                self.auth.logout();
                self.userDetails.data.loggedIn = false;
                self.userDetails.ping();
            }

            if (details == null) {
                return;
            }
            
            self.UpdatePreferences();
            self.CheckForMessagesContinuously();
            
            // details is an XML DOM of user details
            let userInfo = details.getElementsByTagName("user")[0];

            // let moreDetails = new DOMParser().parseFromString(userInfo.innerHTML, "text/xml");

            let data = self.userDetails.data;
            data.loggedIn = true;
            console.log("Login completed, userinfo is ", userInfo);
            data.name = userInfo.getAttribute('display_name');
            data.csCount = userInfo.getElementsByTagName("changesets")[0].getAttribute("count");

            data.img = undefined;
            const imgEl = userInfo.getElementsByTagName("img");
            if (imgEl !== undefined && imgEl[0] !== undefined) {
                data.img = imgEl[0].getAttribute("href");
            }
            data.img = data.img ?? "./assets/osm-logo.svg";

            const homeEl = userInfo.getElementsByTagName("home");
            if (homeEl !== undefined && homeEl[0] !== undefined) {
                const lat = parseFloat(homeEl[0].getAttribute("lat"));
                const lon = parseFloat(homeEl[0].getAttribute("lon"));
                data.home = {lat: lat, lon: lon};
            }

            const messages = userInfo.getElementsByTagName("messages")[0].getElementsByTagName("received")[0];
            data.unreadMessages = parseInt(messages.getAttribute("unread"));
            data.totalMessages = parseInt(messages.getAttribute("count"));
            self.userDetails.ping();
          
        });
    }


    private CheckForMessagesContinuously() {
        const self = this;
        window.setTimeout(() => {
            if (self.userDetails.data.loggedIn) {
                console.log("Checking for messages")
                this.AttemptLogin();
            }
        },  5 * 60 * 1000);
    }

    public preferences = new UIEventSource<any>({});
    public preferenceSources : any = {}
    
    public GetPreference(key: string, prefix : string = "mapcomplete-") : UIEventSource<string>{
        key = prefix+key;
        if (this.preferenceSources[key] !== undefined) {
            return this.preferenceSources[key];
        }
        if (this.userDetails.data.loggedIn && this.preferences.data[key] === undefined) {
            this.UpdatePreferences();
        }
        const pref = new UIEventSource<string>(this.preferences.data[key]);
        pref.addCallback((v) => {
            this.SetPreference(key, v);
        });

        this.preferences.addCallback((prefs) => {
            if (prefs[key] !== undefined) {
                pref.setData(prefs[key]);
            }
        });
        
        this.preferenceSources[key] = pref;
        return pref;
    }
    
    private UpdatePreferences() {
        const self = this;
        this.auth.xhr({
            method: 'GET',
            path: '/api/0.6/user/preferences'
        }, function (error, value: XMLDocument) {
            if(error){
                console.log("Could not load preferences", error);
                return;
            }
            const prefs = value.getElementsByTagName("preference");
            for (let i = 0; i < prefs.length; i++) {
                const pref = prefs[i];
                const k = pref.getAttribute("k");
                const v = pref.getAttribute("v");
                self.preferences.data[k] = v;
            }
            self.preferences.ping();
        });
    }
    
    private SetPreference(k:string, v:string) {
        if(!this.userDetails.data.loggedIn){
            console.log("Not saving preference: user not logged in");
            return;
        }

        if (this.preferences.data[k] === v) {
            console.log("Not updating preference", k, " to ", v, "not changed");
            return;
        }
        console.log("Updating preference", k, " to ", v);

        this.preferences.data[k] = v;
        this.preferences.ping();
        
        if(v === ""){
            this.auth.xhr({
                method: 'DELETE',
                path: '/api/0.6/user/preferences/' + k,
                options: {header: {'Content-Type': 'text/plain'}},
            }, function (error, result) {
                if (error) {
                    console.log("Could not remove preference", error);
                    return;
                }

                console.log("Preference removed!", result == "" ? "OK" : result);

            });
        }
        
        
        this.auth.xhr({
            method: 'PUT',
            path: '/api/0.6/user/preferences/' + k,
            options: {header: {'Content-Type': 'text/plain'}},
            content: v
        }, function (error, result) {
            if (error) {
                console.log("Could not set preference", error);
                return;
            }
            
            console.log("Preference written!", result == "" ? "OK" : result);
            
        });
    }

    private static parseUploadChangesetResponse(response: XMLDocument) {
        const nodes = response.getElementsByTagName("node");
        const mapping = {};
        // @ts-ignore
        for (const node of nodes) {
            const oldId = parseInt(node.attributes.old_id.value);
            const newId = parseInt(node.attributes.new_id.value);
            if (oldId !== undefined && newId !== undefined &&
                !isNaN(oldId) && !isNaN(newId)) {
                mapping["node/" + oldId] = "node/" + newId;
            }
        }
        return mapping;
    }


    public UploadChangeset(generateChangeXML: (csid: string) => string,
                           handleMapping: (idMapping: any) => void,
                           continuation: () => void) {

        if (this._dryRun) {
            console.log("NOT UPLOADING as dryrun is true");
            var changesetXML = generateChangeXML("123456");
            console.log(changesetXML);
            continuation();
            return;
        }

        const self = this;
        this.OpenChangeset(
            function (csId) {
                var changesetXML = generateChangeXML(csId);
                self.AddChange(csId, changesetXML,
                    function (csId, mapping) {
                        self.CloseChangeset(csId, continuation);
                        handleMapping(mapping);
                    }
                );

            }
        );
        
        this.userDetails.data.csCount++;
        this.userDetails.ping();
    }


    private OpenChangeset(continuation: (changesetId: string) => void) {

        const layout = State.state.layoutToUse.data;

        this.auth.xhr({
            method: 'PUT',
            path: '/api/0.6/changeset/create',
            options: {header: {'Content-Type': 'text/xml'}},
            content: [`<osm><changeset>`,
                `<tag k="created_by" v="MapComplete ${State.vNumber}" />`,
                `<tag k="comment" v="Adding data with #MapComplete"/>`,
                `<tag k="theme" v="${layout.name}"/>`,
                layout.maintainer !== undefined ? `<tag k="theme-creator" v="${layout.maintainer}"/>` : "",
                `</changeset></osm>`].join("")
        }, function (err, response) {
            if (response === undefined) {
                console.log("err", err);
                alert("Could not upload change (opening failed). Please file a bug report")
                return;
            } else {
                continuation(response);
            }
        });
    }

    private AddChange(changesetId: string,
                      changesetXML: string,
                      continuation: ((changesetId: string, idMapping: any) => void)){
        this.auth.xhr({
            method: 'POST',
            options: { header: { 'Content-Type': 'text/xml' } },
            path: '/api/0.6/changeset/'+changesetId+'/upload',
            content: changesetXML
        }, function (err, response) {
            if (response == null) {
                console.log("err", err);
                return;
            }
            const mapping = OsmConnection.parseUploadChangesetResponse(response);
            console.log("Uploaded changeset ", changesetId);
            continuation(changesetId, mapping);
        });
    }

    private CloseChangeset(changesetId: string, continuation : (() => void)) {
        console.log("closing");
        this.auth.xhr({
            method: 'PUT',
            path: '/api/0.6/changeset/'+changesetId+'/close',
        }, function (err, response) {
            if (response == null) {

                console.log("err", err);
            }
            console.log("Closed changeset ", changesetId);
            
            if(continuation !== undefined){
                continuation();
            }
        });
    }

}