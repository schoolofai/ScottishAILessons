You're asking for comprehensive documentation of all element types in CircuitJS1's export file format, including their type identifiers and parameter formats.<cite />

## CircuitJS1 Element Type Reference

Each element in CircuitJS1 has a unique type identifier (character or integer) returned by its `getDumpType()` method [1](#1-0) . The element's `dump()` method serializes its state to the export format [2](#1-1) .

### Basic Passive Elements

**Wire (`w`)**
```
w x1 y1 x2 y2 flags
```
Simple connection between two points<cite />.

**Resistor (`r`)**
```
r x1 y1 x2 y2 flags resistance
```
Basic resistor with resistance in ohms<cite />.

**Capacitor (`c`)**
```
c x1 y1 x2 y2 flags capacitance voltdiff initialVoltage
```
- `capacitance`: Capacitance in Farads
- `voltdiff`: Current voltage difference
- `initialVoltage`: Initial voltage (optional) [3](#1-2) 

**Inductor (`l`)**
```
l x1 y1 x2 y2 flags inductance current
```
- `inductance`: Inductance in Henries
- `current`: Current through inductor [4](#1-3) 

**Ground (`g`)**
```
g x1 y1 x2 y2 flags symbolType
```
- `symbolType`: 0=Earth, 1=Chassis, 2=Signal, 3=Common [5](#1-4) 

### Voltage and Current Sources

**Voltage Source (`v`)**
```
v x1 y1 x2 y2 flags waveform frequency maxVoltage bias phaseShift dutyCycle
```
- `waveform`: 0=DC, 1=AC, 2=Square, 3=Triangle, 4=Sawtooth, 5=Pulse, 6=Noise, 7=Variable
- `frequency`: Frequency in Hz
- `maxVoltage`: Peak voltage
- `bias`: DC offset
- `phaseShift`: Phase shift in radians
- `dutyCycle`: Duty cycle (0-1) [6](#1-5) 

**Rail/Power Supply (`R`)**
Similar format to voltage source but simplified<cite />.

**Antenna (`A`)**
```
A x1 y1 x2 y2 flags waveform frequency maxVoltage bias phaseShift dutyCycle
```
Extends voltage source with AC waveform<cite />.

### Semiconductor Elements

**Diode (`d`)**
```
d x1 y1 x2 y2 flags modelName
```
- `modelName`: Diode model identifier (escaped string) [7](#1-6) 

**MOSFET (`f`)**
```
f x1 y1 x2 y2 flags vt beta
```
- `vt`: Threshold voltage
- `beta`: Transconductance parameter [8](#1-7) 

**SCR (Silicon-Controlled Rectifier) (`177`)**
```
177 x1 y1 x2 y2 flags lastvac lastvag triggerI holdingI gresistance
```
- `lastvac`: Last anode-cathode voltage
- `lastvag`: Last anode-gate voltage
- `triggerI`: Trigger current
- `holdingI`: Holding current
- `gresistance`: Gate resistance [9](#1-8) 

**LED (`162`)**
```
162 x1 y1 x2 y2 flags ...
```
LED with diode model parameters<cite />.

### Transformers

**Transformer (`T`)**
```
T x1 y1 x2 y2 flags inductance ratio current0 current1 couplingCoeff
```
- `inductance`: Primary inductance
- `ratio`: Turns ratio
- `current0`, `current1`: Currents in windings
- `couplingCoeff`: Coupling coefficient (0-1) [10](#1-9) 

**Tapped Transformer (`169`)**
```
169 x1 y1 x2 y2 flags inductance ratio current0 current1 current2 couplingCoeff
```
Three-winding transformer [11](#1-10) .

**Custom Transformer (`406`)**
```
406 x1 y1 x2 y2 flags inductance couplingCoeff description coilCount current0 current1 ...
```
- `description`: Coil configuration (escaped string)
- `coilCount`: Number of coils
- Followed by current values for each coil [12](#1-11) 

### Transmission Line

**Transmission Line (`171`)**
```
171 x1 y1 x2 y2 flags delay impedance width resistance
```
- `delay`: Propagation delay in seconds
- `impedance`: Characteristic impedance in ohms
- `width`: Visual width
- `resistance`: Series resistance (not implemented, use 0) [13](#1-12) 

### Switches

**Analog Switch (`159`)**
```
159 x1 y1 x2 y2 flags r_on r_off
```
- `r_on`: On resistance (default 20Ω)
- `r_off`: Off resistance (default 1e10Ω) [14](#1-13) 

**Tri-State Buffer (`180`)**
```
180 x1 y1 x2 y2 flags r_on r_off
```
Similar to analog switch but with logic buffer behavior [15](#1-14) .

**Make-Before-Break Switch (`416`)**
```
416 x1 y1 x2 y2 flags ... link
```
- `link`: Link to paired switch [16](#1-15) 

### Logic Elements

**Inverter (`I`)**
```
I x1 y1 x2 y2 flags slewRate highVoltage
```
- `slewRate`: Slew rate in V/ns
- `highVoltage`: Logic high voltage [17](#1-16) 

**Inverting Schmitt Trigger (`183`)**
```
183 x1 y1 x2 y2 flags slewRate lowerTrigger upperTrigger logicOnLevel logicOffLevel
``` [18](#1-17) 

**Logic Output (`M`)**
```
M x1 y1 x2 y2 flags threshold
```
- `threshold`: Logic threshold voltage [19](#1-18) 

### Measurement Tools

**Probe (`p`)**
```
p x1 y1 x2 y2 flags meter scale
```
- `meter`: Measurement type (0=V, 1=RMS, 2=Max, 3=Min, 4=P2P, 5=Binary, 6=Freq, 7=Period, 8=PulseWidth, 9=Duty)
- `scale`: Display scale [20](#1-19) 

**Ammeter (`a`)**
```
a x1 y1 x2 y2 flags meter scale
```
Similar to probe but measures current [21](#1-20) .

**Output (`O`)**
```
O x1 y1 x2 y2 flags scale
```
Simple voltage output display [22](#1-21) .

### Vacuum Tubes

**Triode (`173`)**
```
173 x1 y1 x2 y2 flags mu kg1
```
- `mu`: Amplification factor
- `kg1`: Perveance parameter [23](#1-22) 

### Special Elements

**Relay (`178`)**
```
178 x1 y1 x2 y2 flags poleCount onResistance ... offResistance ...
```
Multi-pole relay with configurable resistances<cite />.

### Scope Configuration

**Scope Output (`o`)**
```
o pin flags scopeNum color position scale offset
```
Connects circuit node to oscilloscope display<cite />.

### Adjustable Parameters

**Adjustable (`38`)**
```
38 elementDumpData
```
Creates slider control for element parameter [24](#1-23) .

### Model Definitions

**Diode Model (`34`)**
```
34 modelData
```
Custom diode model definition [25](#1-24) .

**Transistor Model (`32`)**
```
32 modelData
```
Custom transistor model definition [26](#1-25) .

**Custom Logic Model (`!`)**
```
! modelData
```
Custom logic chip definition [27](#1-26) .

**Custom Composite Model (`.`)**
```
. modelData
```
Custom composite element definition [28](#1-27) .

## Notes

The element type system uses both single-character codes (like `v`, `r`, `g`) and numeric codes (like `159`, `177`, `406`) for identification [29](#1-28) . Each element class implements `getDumpType()` to return its unique identifier and `dump()` to serialize its parameters<cite />. The parsing logic in `CirSim.java` handles both character and numeric type codes when loading circuits [30](#1-29) . For complete parameter details of any specific element, examine its source file's `dump()` method implementation<cite />.

Wiki pages you might want to explore:
- [Circuit Elements (sharpie7/circuitjs1)](/wiki/sharpie7/circuitjs1#3)
- [Basic Elements (sharpie7/circuitjs1)](/wiki/sharpie7/circuitjs1#3.1)
- [Adding New Component Types (sharpie7/circuitjs1)](/wiki/sharpie7/circuitjs1#7.2)

### Citations

**File:** src/com/lushprojects/circuitjs1/client/CircuitElm.java (L170-175)
```java
    // dump component state for export/undo
    String dump() {
	int t = getDumpType();
	return (t < 127 ? ((char)t)+" " : t+" ") + x + " " + y + " " +
	    x2 + " " + y2 + " " + flags;
    }
```

**File:** src/com/lushprojects/circuitjs1/client/CapacitorElm.java (L33-42)
```java
	public CapacitorElm(int xa, int ya, int xb, int yb, int f,
			    StringTokenizer st) {
	    super(xa, ya, xb, yb, f);
	    capacitance = new Double(st.nextToken()).doubleValue();
	    voltdiff = new Double(st.nextToken()).doubleValue();
	    initialVoltage = 1e-3;
	    try {
		initialVoltage = new Double(st.nextToken()).doubleValue();
	    } catch (Exception e) {}
	}
```

**File:** src/com/lushprojects/circuitjs1/client/InductorElm.java (L39-42)
```java
	int getDumpType() { return 'l'; }
	String dump() {
	    return super.dump() + " " + inductance + " " + current;
	}
```

**File:** src/com/lushprojects/circuitjs1/client/GroundElm.java (L38-41)
```java
	String dump() {
	    return super.dump() + " " + symbolType;
	}
	int getDumpType() { return 'g'; }
```

**File:** src/com/lushprojects/circuitjs1/client/VoltageElm.java (L28-77)
```java
    static final int WF_DC = 0;
    static final int WF_AC = 1;
    static final int WF_SQUARE = 2;
    static final int WF_TRIANGLE = 3;
    static final int WF_SAWTOOTH = 4;
    static final int WF_PULSE = 5;
    static final int WF_NOISE = 6;
    static final int WF_VAR = 7;
    double frequency, maxVoltage, freqTimeZero, bias,
	phaseShift, dutyCycle, noiseValue;
    
    static final double defaultPulseDuty = 1/(2*Math.PI);
    
    VoltageElm(int xx, int yy, int wf) {
	super(xx, yy);
	waveform = wf;
	maxVoltage = 5;
	frequency = 40;
	dutyCycle = .5;
	reset();
    }
    public VoltageElm(int xa, int ya, int xb, int yb, int f,
		      StringTokenizer st) {
	super(xa, ya, xb, yb, f);
	maxVoltage = 5;
	frequency = 40;
	waveform = WF_DC;
	dutyCycle = .5;
	try {
	    waveform = new Integer(st.nextToken()).intValue();
	    frequency = new Double(st.nextToken()).doubleValue();
	    maxVoltage = new Double(st.nextToken()).doubleValue();
	    bias = new Double(st.nextToken()).doubleValue();
	    phaseShift = new Double(st.nextToken()).doubleValue();
	    dutyCycle = new Double(st.nextToken()).doubleValue();
	} catch (Exception e) {
	}
	if ((flags & FLAG_COS) != 0) {
	    flags &= ~FLAG_COS;
	    phaseShift = pi/2;
	}
	
	// old circuit files have the wrong duty cycle for pulse waveforms (wasn't configurable in the past)
	if ((flags & FLAG_PULSE_DUTY) == 0 && waveform == WF_PULSE) {
	    dutyCycle = defaultPulseDuty;
	}
	
	reset();
    }
    int getDumpType() { return 'v'; }
```

**File:** src/com/lushprojects/circuitjs1/client/DiodeElm.java (L84-92)
```java
    int getDumpType() { return 'd'; }
    String dump() {
	flags |= FLAG_MODEL;
/*	if (modelName == null) {
	    sim.console("model name is null??");
	    modelName = "default";
	}*/
	return super.dump() + " " + CustomLogicModel.escape(modelName);
    }
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L101-104)
```java
	String dump() {
	    return super.dump() + " " + vt + " " + beta;
	}
	int getDumpType() { return 'f'; }
```

**File:** src/com/lushprojects/circuitjs1/client/SCRElm.java (L75-80)
```java
    int getDumpType() { return 177; }
    String dump() {
	return super.dump() + " " + (volts[anode]-volts[cnode]) + " " +
	    (volts[anode]-volts[gnode]) + " " + triggerI + " "+  holdingI + " " +
	    gresistance;
    }
```

**File:** src/com/lushprojects/circuitjs1/client/TransformerElm.java (L65-69)
```java
	int getDumpType() { return 'T'; }
	String dump() {
	    return super.dump() + " " + inductance + " " + ratio + " " +
		current[0] + " " + current[1] + " " + couplingCoef;
	}
```

**File:** src/com/lushprojects/circuitjs1/client/TappedTransformerElm.java (L59-63)
```java
	int getDumpType() { return 169; }
	String dump() {
	    return super.dump() + " " + inductance + " " + ratio + " " +
		current[0] + " " + current[1] + " " + current[2] + " " + couplingCoef;
	}
```

**File:** src/com/lushprojects/circuitjs1/client/CustomTransformerElm.java (L78-86)
```java
	int getDumpType() { return 406; }
	String dump() {
	    String s = super.dump() + " " + inductance + " " + couplingCoef + " " + CustomLogicModel.escape(description) + " " + coilCount + " ";
	    int i;
	    for (i = 0; i != coilCount; i++) {
		s += coilCurrents[i] + " ";
	    }
	    return s;
	}
```

**File:** src/com/lushprojects/circuitjs1/client/TransLineElm.java (L45-50)
```java
    int getDumpType() { return 171; }
    int getPostCount() { return 4; }
    int getInternalNodeCount() { return 2; }
    String dump() {
	return super.dump() + " " + delay + " " + imped + " " + width + " " + 0.;
    }
```

**File:** src/com/lushprojects/circuitjs1/client/AnalogSwitchElm.java (L41-45)
```java
    String dump() {
	return super.dump() + " " + r_on + " " + r_off;
    }
    
    int getDumpType() { return 159; }
```

**File:** src/com/lushprojects/circuitjs1/client/TriStateElm.java (L47-53)
```java
    String dump() {
	return super.dump() + " " + r_on + " " + r_off;
    }

    int getDumpType() {
	return 180;
    }
```

**File:** src/com/lushprojects/circuitjs1/client/MBBSwitchElm.java (L48-51)
```java
	int getDumpType() { return 416; }
	String dump() {
	    return super.dump() + " " + link;
	}
```

**File:** src/com/lushprojects/circuitjs1/client/InverterElm.java (L45-49)
```java
	String dump() {
	    return super.dump() + " " + slewRate + " " + highVoltage;
	}
	
	int getDumpType() { return 'I'; }
```

**File:** src/com/lushprojects/circuitjs1/client/InvertingSchmittElm.java (L62-66)
```java
	String dump() {
	    return super.dump() + " " + slewRate+" "+lowerTrigger+" "+upperTrigger+" "+logicOnLevel+" "+logicOffLevel;
	}
	
	int getDumpType() { return 183; }//Trying to find unused type
```

**File:** src/com/lushprojects/circuitjs1/client/LogicOutputElm.java (L41-44)
```java
	String dump() {
	    return super.dump() + " " + threshold;
	}
	int getDumpType() { return 'M'; }
```

**File:** src/com/lushprojects/circuitjs1/client/ProbeElm.java (L57-60)
```java
    int getDumpType() { return 'p'; }
    String dump() {
        return super.dump() + " " + meter + " " + scale;
    }
```

**File:** src/com/lushprojects/circuitjs1/client/AmmeterElm.java (L40-54)
```java
    public AmmeterElm(int xx, int yy) { 
        super(xx, yy); 
        flags = FLAG_SHOWCURRENT;
        scale = SCALE_AUTO;
    }
    public AmmeterElm(int xa, int ya, int xb, int yb, int f,
               StringTokenizer st) {
        super(xa, ya, xb, yb, f);
        scale = SCALE_AUTO;
        meter = Integer.parseInt(st.nextToken());
        try {
            scale = Integer.parseInt(st.nextToken());
        } catch (Exception e) {}
    }
    String dump() {
```

**File:** src/com/lushprojects/circuitjs1/client/OutputElm.java (L38-41)
```java
	String dump() {
	    return super.dump() + " " + scale;
	}
	int getDumpType() { return 'O'; }
```

**File:** src/com/lushprojects/circuitjs1/client/TriodeElm.java (L47-50)
```java
    String dump() {
	return super.dump() + " " + mu + " " + kg1;
    }
    int getDumpType() { return 173; }
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3563-3566)
```java
		    if (tint == '!') {
			CustomLogicModel.undumpModel(st);
			break;
		    }
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3573-3576)
```java
		    // if first character is a digit then parse the type as a number
		    if (tint >= '0' && tint <= '9')
			tint = new Integer(type).intValue();
		    
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3577-3580)
```java
		    if (tint == 34) {
			DiodeModel.undumpModel(st);
			break;
		    }
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3581-3584)
```java
		    if (tint == 32) {
			TransistorModel.undumpModel(st);
			break;
		    }
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3585-3589)
```java
		    if (tint == 38) {
			Adjustable adj = new Adjustable(st, this);
			adjustables.add(adj);
			break;
		    }
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3590-3593)
```java
		    if (tint == '.') {
			CustomCompositeModel.undumpModel(st);
			break;
		    }
```

**File:** src/com/lushprojects/circuitjs1/client/CirSim.java (L3594-3606)
```java
		    int x1 = new Integer(st.nextToken()).intValue();
		    int y1 = new Integer(st.nextToken()).intValue();
		    int x2 = new Integer(st.nextToken()).intValue();
		    int y2 = new Integer(st.nextToken()).intValue();
		    int f  = new Integer(st.nextToken()).intValue();
		    
		    CircuitElm newce = createCe(tint, x1, y1, x2, y2, f, st);
		    if (newce==null) {
				System.out.println("unrecognized dump type: " + type);
				break;
			    }
		    newce.setPoints();
		    elmList.addElement(newce);
```
You're asking for comprehensive documentation of the `flags` parameter used in CircuitJS1's export file format for each component type<cite />.

## CircuitJS1 Component Flags Documentation

The `flags` parameter is a bitfield integer that appears in every element's dump format after the coordinates [1](#2-0) . Different element types use different flag bits to control their behavior and appearance.

### Common Flags (Used Across Multiple Elements)

**FLAG_SMALL (1)** - Used by chip elements and gates to render in compact size [2](#2-1) [3](#2-2) .

**FLAG_FLIP_X (1024)** - Flips chip element horizontally [4](#2-3) .

**FLAG_FLIP_Y (2048)** - Flips chip element vertically [5](#2-4) .

### Capacitor Flags

**FLAG_BACK_EULER (2)** - Uses backward Euler integration method instead of trapezoidal [6](#2-5) .

### MOSFET Flags

**FLAG_PNP (1)** - P-channel MOSFET (default is N-channel) [7](#2-6) .

**FLAG_SHOWVT (2)** - Show threshold voltage [8](#2-7) .

**FLAG_DIGITAL (4)** - Digital/simplified rendering mode [9](#2-8) .

**FLAG_FLIP (8)** - Flip orientation [10](#2-9) .

**FLAG_HIDE_BULK (16)** - Hide bulk terminal [11](#2-10) .

**FLAG_BODY_DIODE (32)** - Enable body diode [12](#2-11) .

**FLAG_BODY_TERMINAL (64)** - Show body terminal [13](#2-12) .

### Voltage Source Flags

**FLAG_COS (2)** - Legacy flag for cosine phase (now uses phaseShift parameter) [14](#2-13) .

**FLAG_PULSE_DUTY (4)** - Indicates pulse duty cycle is configurable [15](#2-14) .

### SCR Flags

**FLAG_GATE_FIX (1)** - Apply gate fix for improved behavior [16](#2-15) .

### Logic Input Flags

**FLAG_TERNARY (1)** - Three-state logic (0, 1, 2) [17](#2-16) .

**FLAG_NUMERIC (2)** - Display numeric values [18](#2-17) .

### Logic Output Flags

**FLAG_TERNARY (1)** - Three-state logic display [19](#2-18) .

**FLAG_NUMERIC (2)** - Numeric display mode [20](#2-19) .

**FLAG_PULLDOWN (4)** - Add pulldown resistor [21](#2-20) .

### Gate Flags

**FLAG_SMALL (1)** - Compact rendering [3](#2-2) .

**FLAG_SCHMITT (2)** - Schmitt trigger behavior [22](#2-21) .

### Analog Switch Flags

**FLAG_INVERT (1)** - Invert control signal [23](#2-22) .

### Controlled Source Flags

**FLAG_SPICE (2)** - SPICE-style implementation (for CCCS and CCVS) [24](#2-23) [25](#2-24) .

### Labeled Node Flags

**FLAG_ESCAPE (4)** - Text is escaped (new format) [26](#2-25) .

**FLAG_INTERNAL (1)** - Internal node (not visible) [27](#2-26) .

### Probe Flags

**FLAG_SHOWVOLTAGE (1)** - Show voltage value [28](#2-27) .

### Sweep Flags

**FLAG_LOG (1)** - Logarithmic sweep [29](#2-28) .

**FLAG_BIDIR (2)** - Bidirectional sweep [30](#2-29) .

### Composite Element Flags

**FLAG_ESCAPE (1)** - Use escape/unescape for nested elements [31](#2-30) .

## Flag Usage in Export Format

Flags are combined using bitwise OR operations. For example, a small Schmitt trigger gate would have `flags = 1 | 2 = 3`<cite />.

When parsing, elements check flags using bitwise AND: `(flags & FLAG_NAME) != 0` [32](#2-31) .

## Notes

Each element type defines its own flag constants, so the same numeric value can mean different things for different elements<cite />. The flags parameter appears in the standard position (5th parameter) in the dump format: `type x1 y1 x2 y2 flags ...` [1](#2-0) . Not all elements use flags - some simply pass 0 or use the default value returned by `getDefaultFlags()`<cite />. When creating circuits programmatically, you can typically use 0 for flags unless you need specific behavior modifications<cite />.

Wiki pages you might want to explore:
- [Circuit Elements (sharpie7/circuitjs1)](/wiki/sharpie7/circuitjs1#3)
- [Voltage and Current Sources (sharpie7/circuitjs1)](/wiki/sharpie7/circuitjs1#3.2)
- [Adding New Component Types (sharpie7/circuitjs1)](/wiki/sharpie7/circuitjs1#7.2)

### Citations

**File:** src/com/lushprojects/circuitjs1/client/CircuitElm.java (L171-175)
```java
    String dump() {
	int t = getDumpType();
	return (t < 127 ? ((char)t)+" " : t+" ") + x + " " + y + " " +
	    x2 + " " + y2 + " " + flags;
    }
```

**File:** src/com/lushprojects/circuitjs1/client/ChipElm.java (L25-25)
```java
	final int FLAG_SMALL = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/ChipElm.java (L26-26)
```java
	final int FLAG_FLIP_X = 1024;
```

**File:** src/com/lushprojects/circuitjs1/client/ChipElm.java (L27-27)
```java
	final int FLAG_FLIP_Y = 2048;
```

**File:** src/com/lushprojects/circuitjs1/client/GateElm.java (L23-23)
```java
	final int FLAG_SMALL = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/GateElm.java (L24-24)
```java
	final int FLAG_SCHMITT = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/CapacitorElm.java (L27-27)
```java
	public static final int FLAG_BACK_EULER = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/CapacitorElm.java (L43-43)
```java
	boolean isTrapezoidal() { return (flags & FLAG_BACK_EULER) == 0; }
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L24-24)
```java
	int FLAG_PNP = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L25-25)
```java
	int FLAG_SHOWVT = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L26-26)
```java
	int FLAG_DIGITAL = 4;
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L27-27)
```java
	int FLAG_FLIP = 8;
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L28-28)
```java
	int FLAG_HIDE_BULK = 16;
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L29-29)
```java
	int FLAG_BODY_DIODE = 32;
```

**File:** src/com/lushprojects/circuitjs1/client/MosfetElm.java (L30-30)
```java
	int FLAG_BODY_TERMINAL = 64;
```

**File:** src/com/lushprojects/circuitjs1/client/VoltageElm.java (L25-25)
```java
    static final int FLAG_COS = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/VoltageElm.java (L26-26)
```java
    static final int FLAG_PULSE_DUTY = 4;
```

**File:** src/com/lushprojects/circuitjs1/client/SCRElm.java (L34-34)
```java
    final int FLAG_GATE_FIX = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/LogicInputElm.java (L23-23)
```java
	final int FLAG_TERNARY = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/LogicInputElm.java (L24-24)
```java
	final int FLAG_NUMERIC = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/LogicOutputElm.java (L23-23)
```java
	final int FLAG_TERNARY = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/LogicOutputElm.java (L24-24)
```java
	final int FLAG_NUMERIC = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/LogicOutputElm.java (L25-25)
```java
	final int FLAG_PULLDOWN = 4;
```

**File:** src/com/lushprojects/circuitjs1/client/AnalogSwitchElm.java (L23-23)
```java
    final int FLAG_INVERT = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/CCCSElm.java (L25-25)
```java
	static int FLAG_SPICE = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/CCVSElm.java (L27-27)
```java
    	static int FLAG_SPICE = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/LabeledNodeElm.java (L25-25)
```java
    final int FLAG_ESCAPE = 4;
```

**File:** src/com/lushprojects/circuitjs1/client/LabeledNodeElm.java (L26-26)
```java
    final int FLAG_INTERNAL = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/ProbeElm.java (L25-25)
```java
    static final int FLAG_SHOWVOLTAGE = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/SweepElm.java (L24-24)
```java
    final int FLAG_LOG = 1;
```

**File:** src/com/lushprojects/circuitjs1/client/SweepElm.java (L25-25)
```java
    final int FLAG_BIDIR = 2;
```

**File:** src/com/lushprojects/circuitjs1/client/CompositeElm.java (L24-24)
```java
    final int FLAG_ESCAPE = 1;
```
