/*
 *     Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 *
 *     This file is part of Wirecloud Platform.
 *
 *     Wirecloud Platform is free software: you can redistribute it and/or
 *     modify it under the terms of the GNU Affero General Public License as
 *     published by the Free Software Foundation, either version 3 of the
 *     License, or (at your option) any later version.
 *
 *     Wirecloud is distributed in the hope that it will be useful, but WITHOUT
 *     ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 *     FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 *     License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with Wirecloud Platform.  If not, see
 *     <http://www.gnu.org/licenses/>.
 *
 */

(function (Wirecloud) {
    "use strict";

    var privates = window._privs;
    delete window._privs; // Remove privates from global scope

    var createAPIComponent = function createAPIComponent(type, requirements, componentClass, shadowRoot, id, viewid) {
        // We create an object that will contain the MashupPlatform object
        // tailored for the specific component, as well as any other object
        // created by the different APIs
        var container = {};

        privates._APIBootstrap(Wirecloud, Wirecloud.Utils, container, id, viewid);
        if (type === "widget") {
            privates._WidgetAPI(container);
        } else if (type === "operator") {
            privates._OperatorAPI(container);
        }
        privates._APICommon(container, window, shadowRoot);

        // StyledElements is not required, as the object is available in the window object
        requirements.forEach(function (requirement) {
            if (requirement.name in Wirecloud.APIRequirements) {
                Wirecloud.APIRequirements[requirement.name](container, window, shadowRoot);
            } else if (requirement.name === "StyledElements") {
                // But we still include it in the container to be consistent
                container.StyledElements = window.StyledElements;
            }
        });

        privates._APIClosure(container);

        // We instantiate the actual component
        let MashupPlatform = container.MashupPlatform;

        var component = undefined;
        if (type === "widget") {
            component = new componentClass(MashupPlatform, shadowRoot, container);
        } else if (type === "operator") {
            component = new componentClass(MashupPlatform, container);
        }

        return component;
    }

    Wirecloud.createAPIComponent = createAPIComponent;

    // Plugins can register new requirements
    Wirecloud.APIRequirements = {
        DashboardManagement: privates._DashboardManagementAPI,
        ComponentManagement: privates._ComponentManagementAPI
    };

})(window.Wirecloud);