import { useState } from "react";
import { Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  connectionGroupsFromProfile,
  connectionPointsForItem,
  defaultConnectionPointGroups,
  expandConnectionPointGroups,
  groupConnectionPoints,
} from "../utils/rackUtils";
import { getSwitchModelConnectionProfile } from "../lib/switchModels.js";
import SwitchBrandCombobox from "./SwitchBrandCombobox.jsx";
import SwitchModelCombobox from "./SwitchModelCombobox.jsx";

const FIELDS = [
  ["label", "Device name"],
  ["ruHeight", "Rack height (U)"],
  ["brand", "Brand / manufacturer"],
  ["model", "Model"],
  ["ipAddress", "IP address"],
  ["macAddress", "MAC address"],
  ["serialNumber", "Serial number"],
  ["assetTag", "Asset tag"],
  ["notes", "Notes"],
];

const groupTemplate = () => ({
  id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "Network",
  category: "network",
  medium: "copper",
  direction: "bidirectional",
  face: "front",
  count: 1,
  points: [],
});
const SWITCH_TYPES = new Set(["switch", "catalyst_2960", "extreme_switch"]);
const MODEL_CATALOG_TYPES = new Set([
  "server",
  "router",
  "firewall",
  "nas",
  "storage",
  "nvr",
  "ups",
]);
const SWITCH_PORT_PREFIXES = [
  {
    prefix: "Gi",
    type: "GigabitEthernet",
    example: "Gi1/0/1",
    pattern: "Gi1/0/{n}",
  },
  {
    prefix: "Fa",
    type: "FastEthernet (100 Mbps)",
    example: "Fa0/1",
    pattern: "Fa0/{n}",
  },
  {
    prefix: "Te",
    type: "TenGigabitEthernet (10 Gbps)",
    example: "Te1/1/1",
    pattern: "Te1/1/{n}",
  },
  {
    prefix: "Fo",
    type: "FortyGigabitEthernet (40 Gbps)",
    example: "Fo1/1/1",
    pattern: "Fo1/1/{n}",
  },
  {
    prefix: "Hu",
    type: "HundredGigabitEthernet (100 Gbps)",
    example: "Hu1/1/1",
    pattern: "Hu1/1/{n}",
  },
  {
    prefix: "Eth",
    type: "Ethernet (varies by vendor)",
    example: "Eth1/1",
    pattern: "Eth1/{n}",
  },
];

function switchPortPattern(value, category) {
  const match = SWITCH_PORT_PREFIXES.find(
    (option) =>
      option.pattern === value ||
      option.prefix === value ||
      value?.startsWith(option.prefix),
  );
  return (
    match?.pattern ||
    (category === "fibre" ? "Te1/1/{n}" : SWITCH_PORT_PREFIXES[0].pattern)
  );
}

function isSwitchPortPattern(value) {
  return SWITCH_PORT_PREFIXES.some(
    (option) =>
      option.pattern === value ||
      option.prefix === value ||
      value?.startsWith(option.prefix),
  );
}

function connectionGroupFingerprint(groups) {
  return JSON.stringify(
    (groups || []).map((group) => ({
      templateKey: group.templateKey || null,
      name: group.name,
      category: group.category,
      medium: group.medium,
      direction: group.direction,
      face: group.face || (group.medium === "power" ? "rear" : "front"),
      count: Number(group.count) || 0,
      startIndex: group.startIndex ?? 1,
      appendIndex: group.appendIndex ?? true,
      speedMbps: group.speedMbps ?? null,
      poeCapability: group.poeCapability || "unknown",
      connectorType: group.connectorType || null,
    })),
  );
}

function normalizePowerGroup(group) {
  if (group.medium !== "power" && !["power_input", "power_output"].includes(group.category)) return group;
  const direction = group.direction === "output" ? "output" : "input";
  const defaultName = direction === "output" ? "Power output" : "Power input";
  const genericName = !group.name || ["Network", "Connection", "Other"].includes(group.name);
  return {
    ...group,
    name: genericName ? defaultName : group.name,
    category: direction === "output" ? "power_output" : "power_input",
    medium: "power",
    direction,
    face: "rear",
  };
}

function getBatteryAgeStatus(installedDate) {
  if (!installedDate) return null;
  const installed = new Date(`${installedDate}T00:00:00`);
  if (Number.isNaN(installed.getTime())) return null;

  const today = new Date();
  let months =
    (today.getFullYear() - installed.getFullYear()) * 12 +
    today.getMonth() -
    installed.getMonth();
  if (today.getDate() < installed.getDate()) months -= 1;
  months = Math.max(0, months);

  if (months < 6) return { level: "green", label: `${months} months old` };
  if (months <= 12) return { level: "yellow", label: `${months} months old` };
  return { level: "red", label: `${months} months old` };
}

export default function DevicePropertiesModal({ item, user, onSave, onClose, onDelete }) {
  const withHeight = (device) => {
    if (!device) return {};
    const points = connectionPointsForItem(device);
    return {
      ...device,
      ruHeight: Math.abs(device.startRU - device.endRU) + 1,
      connectionGroups: points.length
        ? groupConnectionPoints(points).map(normalizePowerGroup)
        : defaultConnectionPointGroups(device.type),
      connectionPointsCustomized:
        device.connectionPointsCustomized ??
        Boolean(device.connectionPoints?.length),
    };
  };
  const [values, setValues] = useState(() => withHeight(item));
  const [profileMessage, setProfileMessage] = useState("");
  const [expandedConnectionDetails, setExpandedConnectionDetails] = useState(
    () => new Set(),
  );

  if (!item) return null;
  const isPatchPanel = item.type === "patch_panel";
  const isSwitch = SWITCH_TYPES.has(item.type);
  const isUps = item.type === "ups";
  const isPdu = item.type === "pdu";
  const batteryAgeStatus = getBatteryAgeStatus(values.batteryInstalledDate);
  const groups = values.connectionGroups || [];
  const updateGroup = (index, update) =>
    setValues({
      ...values,
      connectionPointsCustomized: true,
      connectionGroups: groups.map((group, groupIndex) => {
        if (groupIndex !== index) return group;
        const next = { ...group, ...update };
        if (["power_input", "power_output"].includes(update.category)) {
          next.medium = "power";
          next.direction = update.category === "power_output" ? "output" : "input";
          next.face = "rear";
        } else if (
          ["input", "output"].includes(update.direction) &&
          (next.medium === "power" || ["power_input", "power_output"].includes(next.category))
        ) {
          next.category = update.direction === "output" ? "power_output" : "power_input";
          next.medium = "power";
          next.face = "rear";
        }
        return normalizePowerGroup(next);
      }),
    });

  function hasCustomizedConnectionPoints() {
    if (values.connectionPointsCustomized) return true;
    if (!values.connectionProfileFingerprint) return false;
    return (
      connectionGroupFingerprint(groups) !== values.connectionProfileFingerprint
    );
  }

  function confirmConnectionPointReplacement(message) {
    return !hasCustomizedConnectionPoints() || window.confirm(message);
  }

  function changeManufacturer(manufacturer) {
    if (
      values.connectionProfileId &&
      !confirmConnectionPointReplacement(
        "Changing the manufacturer will remove the generated connection profile and your connection-point edits. Continue?",
      )
    )
      return false;
    setProfileMessage("");
    setValues({
      ...values,
      ...manufacturer,
      switchModelId: null,
      model: "",
      customModel: "",
      modelCatalogLevel: null,
      connectionProfileId: null,
      connectionProfileVersion: null,
      connectionProfileAppliedAt: null,
      connectionProfileFingerprint: null,
      connectionPointsCustomized: false,
      connectionGroups: values.connectionProfileId ? [] : groups,
    });
    return true;
  }

  function changeGenericManufacturer(manufacturer) {
    const sameManufacturer =
      (manufacturer.catalogBrandId &&
        manufacturer.catalogBrandId === values.catalogBrandId) ||
      (manufacturer.savedBrandId &&
        manufacturer.savedBrandId === values.savedBrandId) ||
      (!manufacturer.catalogBrandId &&
        !manufacturer.savedBrandId &&
        manufacturer.brand === values.brand);
    setValues({
      ...values,
      ...manufacturer,
      catalogModelId: sameManufacturer ? values.catalogModelId : null,
      model: sameManufacturer ? values.model : "",
      customModel: sameManufacturer ? values.customModel : "",
    });
    return true;
  }

  async function changeModel(model) {
    if (
      (model.switchModelId && model.switchModelId === values.switchModelId) ||
      (model.catalogModelId && model.catalogModelId === values.catalogModelId)
    ) {
      setValues({ ...values, ...model });
      return true;
    }

    let profile = null;
    if (model.switchModelId && model.connectionProfileId) {
      try {
        profile = await getSwitchModelConnectionProfile(model.switchModelId);
      } catch {
        setProfileMessage(
          "The verified connection profile could not be loaded. The model was not changed.",
        );
        return false;
      }
    }

    const replacesPoints = Boolean(profile || values.connectionProfileId);
    if (
      replacesPoints &&
      !confirmConnectionPointReplacement(
        "Replace the current connection points with this model profile? Your manual connection-point edits will be removed.",
      )
    )
      return false;

    if (profile) {
      const profileGroups = connectionGroupsFromProfile(profile, groups);
      setValues({
        ...values,
        ...model,
        connectionProfileId: profile.id,
        connectionProfileVersion: profile.version,
        connectionProfileAppliedAt: new Date().toISOString(),
        connectionProfileFingerprint: connectionGroupFingerprint(profileGroups),
        connectionPointsCustomized: false,
        connectionGroups: profileGroups,
      });
      const pointCount = profileGroups.reduce(
        (total, group) => total + Number(group.count || 0),
        0,
      );
      setProfileMessage(
        `Verified connection profile v${profile.version} applied. ${pointCount} connection points generated.`,
      );
      return true;
    }

    setValues({
      ...values,
      ...model,
      connectionProfileId: null,
      connectionProfileVersion: null,
      connectionProfileAppliedAt: null,
      connectionProfileFingerprint: null,
      connectionPointsCustomized: values.connectionProfileId
        ? false
        : values.connectionPointsCustomized,
      connectionGroups: values.connectionProfileId ? [] : groups,
    });
    setProfileMessage(
      model.switchModelId
        ? "No verified connection profile is available for this catalog entry. Existing connection points were preserved."
        : "",
    );
    return true;
  }

  function saveDevice(event) {
    event.preventDefault();
    const { connectionGroups, ...device } = values;
    const connectionPointsCustomized = device.connectionProfileId
      ? hasCustomizedConnectionPoints()
      : Boolean(device.connectionPointsCustomized);
    onSave({
      ...device,
      connectionPointsCustomized,
      connectionPoints: expandConnectionPointGroups(connectionGroups || []),
    });
  }

  return (
    <div
      className="device-properties-backdrop"
      role="presentation"
      onPointerDown={onClose}
    >
      <form
        className="device-properties-modal"
        aria-label="Device properties"
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={saveDevice}
      >
        <header>
          <div>
            <p>Rack device</p>
            <h2>Device properties</h2>
          </div>
          <button
            type="button"
            title="Close device properties"
            aria-label="Close device properties"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="device-properties-type">
          {item.type?.replace(/_/g, " ")}
        </div>
        <div className="device-properties-fields">
          {FIELDS.map(([key, label]) => {
            if (key === "brand" && isSwitch)
              return (
                <div className="device-property-field" key={key}>
                  <span>{label}</span>
                  <SwitchBrandCombobox
                    brandId={values.switchBrandId}
                    brandName={values.brand}
                    customManufacturer={values.customManufacturer}
                    userId={user?.id}
                    onChange={changeManufacturer}
                  />
                </div>
              );
            if (key === "brand" && MODEL_CATALOG_TYPES.has(item.type))
              return (
                <div className="device-property-field" key={key}>
                  <span>{label}</span>
                  <SwitchBrandCombobox
                    deviceType={item.type}
                    brandId={values.catalogBrandId}
                    savedBrandId={values.savedBrandId}
                    brandName={values.brand}
                    customManufacturer={values.customManufacturer}
                    userId={user?.id}
                    onChange={changeGenericManufacturer}
                  />
                </div>
              );
            if (
              key === "model" &&
              (isSwitch || MODEL_CATALOG_TYPES.has(item.type))
            )
              return (
                <div className="device-property-field" key={key}>
                  <span>{label}</span>
                  <SwitchModelCombobox
                    deviceType={isSwitch ? "switch" : item.type}
                    brandId={values.switchBrandId}
                    catalogBrandId={values.catalogBrandId}
                    savedBrandId={values.savedBrandId}
                    brandName={values.brand}
                    modelId={
                      isSwitch
                        ? values.switchModelId
                        : values.catalogModelId
                    }
                    modelName={values.model}
                    customModel={values.customModel}
                    userId={user?.id}
                    onChange={changeModel}
                  />
                  {profileMessage && (
                    <small className="connection-profile-message" role="status">
                      {profileMessage}
                    </small>
                  )}
                </div>
              );
            return (
              <label key={key}>
                {label}
                {key === "notes" ? (
                  <textarea
                    value={values[key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                  />
                ) : (
                  <input
                    type={key === "ruHeight" ? "number" : "text"}
                    min={key === "ruHeight" ? 1 : undefined}
                    value={values[key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                  />
                )}
              </label>
            );
          })}
        </div>
        {isPdu && (
          <section className="pdu-mount-details">
            <div>
              <h3>PDU mounting</h3>
              <small>Use vertical mode for a zero-U power rail mounted beside the rack.</small>
            </div>
            <div className="pdu-mount-fields">
              <label>
                <span>Orientation</span>
                <select
                  value={values.pduOrientation || "horizontal"}
                  onChange={(event) =>
                    setValues({ ...values, pduOrientation: event.target.value })
                  }
                >
                  <option value="horizontal">Horizontal rack unit</option>
                  <option value="vertical">Vertical 0U power rail</option>
                </select>
              </label>
              <label>
                <span>Rail side</span>
                <select
                  value={values.pduRailSide || "right"}
                  disabled={(values.pduOrientation || "horizontal") !== "vertical"}
                  onChange={(event) =>
                    setValues({ ...values, pduRailSide: event.target.value })
                  }
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </section>
        )}
        {isUps && (
          <section className="ups-battery-details">
            <div className="ups-battery-heading">
              <span>
                <h3>Battery details</h3>
                <small>Track the installed battery set and its age.</small>
              </span>
              {batteryAgeStatus && (
                <strong className={`ups-battery-status is-${batteryAgeStatus.level}`}>
                  <i aria-hidden="true" />
                  {batteryAgeStatus.label}
                </strong>
              )}
            </div>
            <div className="ups-battery-fields">
              <label>
                <span>Total batteries</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={values.totalBatteries || ""}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      totalBatteries: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Installed date</span>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={values.batteryInstalledDate || ""}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      batteryInstalledDate: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </section>
        )}
        <section className="device-connection-points">
          <div>
            <span>
              <h3>Connection points</h3>
              <small>
                {isPatchPanel
                  ? "Set the panel identifier and number of ports. Identifier G creates G1, G2, and so on."
                  : isSwitch
                    ? "Choose the interface type, then set the number of switch ports."
                    : "Enter a port prefix such as Gi, Mi, or Gi1/0/, then set the quantity."}
              </small>
            </span>
            <button
              type="button"
              title="Add connection group"
              aria-label="Add connection group"
              onClick={() =>
                setValues({
                  ...values,
                  connectionPointsCustomized: true,
                  connectionGroups: [...groups, groupTemplate()],
                })
              }
            >
              <Plus size={16} />
            </button>
          </div>
          {groups.map((group, index) => {
            const useSwitchPrefix =
              isSwitch &&
              !["power_input", "power_output"].includes(group.category) &&
              isSwitchPortPattern(group.name);
            return (
              <div className="device-connection-point" key={group.id}>
                <label className="device-connection-identifier">
                  <span>
                    {isPatchPanel && index === 0
                      ? "Panel identifier"
                      : "Port prefix"}
                  </span>
                  {useSwitchPrefix ? (
                    <select
                      className="device-connection-prefix-select"
                      aria-label={`Connection group ${index + 1} port prefix`}
                      value={switchPortPattern(group.name, group.category)}
                      onChange={(event) =>
                        updateGroup(index, { name: event.target.value })
                      }
                    >
                      {SWITCH_PORT_PREFIXES.map((option) => (
                        <option key={option.prefix} value={option.pattern}>
                          {option.prefix} — {option.type} — {option.example}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={
                        isPatchPanel && index === 0
                          ? "Patch panel identifier"
                          : `Connection group ${index + 1} port prefix`
                      }
                      title="Port prefix or pattern. Use {n} for the port number."
                      placeholder={
                        isPatchPanel && index === 0 ? "e.g. G" : "e.g. Gi"
                      }
                      value={group.name}
                      onChange={(event) =>
                        updateGroup(index, { name: event.target.value })
                      }
                    />
                  )}
                </label>
                <label className="device-connection-field">
                  <span>Category</span>
                  <select
                    aria-label={`Connection group ${index + 1} category`}
                    value={group.category}
                    onChange={(event) =>
                      updateGroup(index, { category: event.target.value })
                    }
                  >
                    <option value="network">Network</option>
                    <option value="wan">WAN</option>
                    <option value="fibre">Fibre</option>
                    <option value="power_input">Power input</option>
                    <option value="power_output">Power output</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="device-connection-field">
                  <span>Medium</span>
                  <select
                    aria-label={`Connection group ${index + 1} medium`}
                    value={group.medium}
                    onChange={(event) =>
                      updateGroup(index, { medium: event.target.value })
                    }
                  >
                    <option value="copper">Copper</option>
                    <option value="fibre">Fibre</option>
                    <option value="power">Power</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="device-connection-field">
                  <span>Direction</span>
                  <select
                    aria-label={`Connection group ${index + 1} direction`}
                    value={group.direction}
                    onChange={(event) =>
                      updateGroup(index, { direction: event.target.value })
                    }
                  >
                    <option value="bidirectional">Bidirectional</option>
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                  </select>
                </label>
                <label className="device-connection-quantity">
                  <span>Ports</span>
                  <input
                    className="device-connection-count"
                    type="number"
                    min="1"
                    max="512"
                    aria-label={`Connection group ${index + 1} count`}
                    title="Number of ports"
                    value={group.count}
                    onChange={(event) =>
                      updateGroup(index, { count: event.target.value })
                    }
                  />
                </label>
                <div className="device-connection-actions">
                  <button
                    type="button"
                    className={
                      expandedConnectionDetails.has(group.id)
                        ? "is-active"
                        : undefined
                    }
                    title="Edit port face and details"
                    aria-label={`Edit ${group.name || "connection"} port details`}
                    aria-expanded={expandedConnectionDetails.has(group.id)}
                    onClick={() =>
                      setExpandedConnectionDetails((current) => {
                        const next = new Set(current);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                  <button
                    type="button"
                    title="Remove connection group"
                    aria-label={`Remove ${group.name || "connection"} group`}
                    onClick={() =>
                      setValues({
                        ...values,
                        connectionPointsCustomized: true,
                        connectionGroups: groups.filter(
                          (_, groupIndex) => groupIndex !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {expandedConnectionDetails.has(group.id) && (
                    <div className="device-connection-metadata">
                      <label>
                        <span>Rack face</span>
                        <select
                          aria-label={`Connection group ${index + 1} rack face`}
                          value={group.face || (group.medium === "power" ? "rear" : "front")}
                          onChange={(event) =>
                            updateGroup(index, { face: event.target.value })
                          }
                        >
                          <option value="front">Front</option>
                          <option value="rear">Rear</option>
                        </select>
                      </label>
                      {isSwitch && <label>
                        <span>Speed (Mbps)</span>
                        <input
                          type="number"
                          min="1"
                          aria-label={`Connection group ${index + 1} speed in Mbps`}
                          value={group.speedMbps || ""}
                          onChange={(event) =>
                            updateGroup(index, {
                              speedMbps: event.target.value
                                ? Number(event.target.value)
                                : null,
                            })
                          }
                        />
                      </label>}
                      {isSwitch && <label>
                        <span>PoE</span>
                        <select
                          aria-label={`Connection group ${index + 1} PoE capability`}
                          value={group.poeCapability || "unknown"}
                          onChange={(event) =>
                            updateGroup(index, {
                              poeCapability: event.target.value,
                            })
                          }
                        >
                          <option value="unknown">Unknown</option>
                          <option value="none">None</option>
                          <option value="poe">PoE</option>
                          <option value="poe_plus">PoE+</option>
                          <option value="poe_plus_plus">PoE++</option>
                          <option value="pass_through">Pass-through</option>
                        </select>
                      </label>}
                      {isSwitch && <label>
                        <span>Connector</span>
                        <input
                          type="text"
                          maxLength="80"
                          aria-label={`Connection group ${index + 1} connector type`}
                          value={group.connectorType || ""}
                          onChange={(event) =>
                            updateGroup(index, {
                              connectorType: event.target.value || null,
                            })
                          }
                        />
                      </label>}
                    </div>
                )}
              </div>
            );
          })}
        </section>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {onDelete && (
            <button
              type="button"
              className="device-properties-delete"
              onClick={() => {
                if (window.confirm("Delete this device from the rack? This cannot be undone.")) onDelete();
              }}
            >
              <Trash2 size={15} />
              Delete device
            </button>
          )}
          <button type="submit">Save device</button>
        </footer>
      </form>
    </div>
  );
}
