import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, Modal, PanResponder, Pressable,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { TOOLS } from './src/tools';
import { hasLocalEngine, processLocalImage } from './src/local';

const W = Dimensions.get('window').width;

function Slider({ value, min = 0, max = 100, onChange }) {
  const width = W - 72;
  const setFromX = x => {
    const p = Math.max(0, Math.min(1, x / width));
    onChange(Math.round(min + p * (max - min)));
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => setFromX(e.nativeEvent.locationX),
    onPanResponderMove: e => setFromX(e.nativeEvent.locationX)
  }), [value]);
  const pct = ((value - min) / (max - min)) * 100;
  return <View style={styles.slider} {...pan.panHandlers}>
    <View style={[styles.sliderFill, { width: `${pct}%` }]} />
    <View style={[styles.sliderKnob, { left: `${pct}%` }]} />
  </View>;
}

function BeforeAfter({ before, after, height = 330 }) {
  const [split, setSplit] = useState(50);
  const [width, setWidth] = useState(W - 32);
  const updateSplit = e => {
    if (!after || !width) return;
    const x = e.nativeEvent.locationX;
    setSplit(Math.max(3, Math.min(97, (x / width) * 100)));
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !!after,
    onMoveShouldSetPanResponder: () => !!after,
    onPanResponderGrant: updateSplit,
    onPanResponderMove: updateSplit
  }), [after, width]);

  return <View
    style={[styles.preview, { height }]}
    onLayout={e => setWidth(e.nativeEvent.layout.width)}
    {...(after ? pan.panHandlers : {})}
  >
    <Image pointerEvents="none" source={{ uri: before }} style={StyleSheet.absoluteFill} resizeMode="contain" />
    {after && <View pointerEvents="none" style={[styles.afterClipRight, { width: `${100 - split}%` }]}>
      <Image source={{ uri: after }} style={{ position:'absolute', right:0, top:0, width, height }} resizeMode="contain" />
    </View>}
    {after && <View pointerEvents="none" style={[styles.splitLine, { left: `${split}%` }]}>
      <View style={[styles.splitDot, { top: Math.max(10, height / 2 - 18) }]}><Ionicons name="swap-horizontal" size={18} color="#08100d" /></View>
    </View>}
    <View pointerEvents="none" style={styles.previewTag}><Text style={styles.previewTagText}>BEFORE</Text></View>
    {after && <View pointerEvents="none" style={[styles.previewTag, { right: 8, left: undefined }]}><Text style={styles.previewTagText}>AFTER</Text></View>}
  </View>;
}

export default function App() {
  const [asset, setAsset] = useState(null);
  const [resultUri, setResultUri] = useState(null);
  const [toolId, setToolId] = useState('upscale');
  const [strength, setStrength] = useState(55);
  const [creativity, setCreativity] = useState(35);
  const [scale, setScale] = useState(2);
  const [upscaleMode, setUpscaleMode] = useState('fast');
  const [lighting, setLighting] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyView, setHistoryView] = useState(null);
  const activeTool = TOOLS.find(t => t.id === toolId) || TOOLS[0];
  const localReady = hasLocalEngine();

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled) { setAsset(res.assets[0]); setResultUri(null); }
  }

  async function enhance() {
    if (!asset) return pick();
    if (!activeTool.available) {
      return Alert.alert('Not enabled yet', `${activeTool.name} needs another offline model. I left it visible so the app can grow without pretending the feature already works.`);
    }
    if (!localReady) return Alert.alert('Local engine missing', 'Install the newest ClarityForge APK with the offline Android engine included.');
    setBusy(true);
    try {
      const params = { strength: strength / 100, creativity: creativity / 100, scale, lighting, mode: upscaleMode };
      const uri = await processLocalImage(asset, toolId, params);
      setResultUri(uri);
      setHistory(h => [{ tool: activeTool.name, uri, before: asset.uri, at: new Date().toISOString() }, ...h].slice(0, 12));
    } catch (e) {
      Alert.alert('Processing failed', e?.message || 'The local processing engine could not finish this image.');
    } finally {
      setBusy(false);
    }
  }

  async function saveUri(uri) {
    if (!uri) return;
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Photo-library permission is required to save the result.');
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert('Saved', 'Enhanced image saved to your photo library.');
  }

  function control() {
    if (!activeTool?.control || !activeTool.available) return null;
    if (activeTool.control === 'scale') return <View style={styles.controlBox}>
      <Text style={styles.controlLabel}>AI output scale</Text>
      <View style={styles.segmentRow}>{[2,4].map(n => <Pressable key={n} onPress={() => setScale(n)} style={[styles.segment, scale===n && styles.segmentActive]}><Text style={styles.segmentText}>{n}×</Text></Pressable>)}</View>
      <Text style={[styles.controlLabel,{marginTop:16}]}>Processing mode</Text>
      <View style={styles.segmentRow}>
        <Pressable onPress={() => setUpscaleMode('fast')} style={[styles.segment, upscaleMode==='fast' && styles.segmentActive]}><Text style={styles.segmentText}>Fast</Text><Text style={styles.segmentSub}>Recommended</Text></Pressable>
        <Pressable onPress={() => setUpscaleMode('quality')} style={[styles.segment, upscaleMode==='quality' && styles.segmentActive]}><Text style={styles.segmentText}>Max detail</Text><Text style={styles.segmentSub}>Slower</Text></Pressable>
      </View>
      <Text style={styles.smallHelp}>{upscaleMode === 'fast' ? 'Fast mode limits very large source images before ESRGAN so the phone has far fewer AI tiles to process.' : 'Max Detail keeps more source resolution and can take considerably longer on large images.'}</Text>
    </View>;
    if (activeTool.control === 'lighting') return <View style={styles.controlBox}>
      <Text style={styles.controlLabel}>Lighting issue</Text>
      <View style={styles.wrap}>{['underexposed','overexposed','low_contrast','balanced'].map(v => <Pressable key={v} onPress={() => setLighting(v)} style={[styles.pill, lighting===v && styles.pillActive]}><Text style={styles.pillText}>{v.replace('_',' ')}</Text></Pressable>)}</View>
    </View>;
    const isCreative = activeTool.control === 'creativity';
    const val = isCreative ? creativity : strength;
    const setter = isCreative ? setCreativity : setStrength;
    return <View style={styles.controlBox}><View style={styles.controlHeader}><Text style={styles.controlLabel}>{isCreative ? 'Creativity' : 'Strength'}</Text><Text style={styles.controlValue}>{val}%</Text></View><Slider value={val} onChange={setter} /></View>;
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" />
    <View style={styles.topbar}>
      <View><Text style={styles.brand}>ClarityForge <Text style={styles.brandAccent}>AI</Text></Text><Text style={styles.subbrand}>PRIVATE • LOCAL • FREE</Text></View>
      <Pressable onPress={() => setInfo(true)} style={styles.iconBtn}><Ionicons name="information-circle-outline" size={24} color="#d7e4df" /></Pressable>
    </View>

    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.localBanner}>
        <View style={[styles.dot, { backgroundColor: localReady ? '#8ff0bd' : '#ffb066' }]} />
        <View style={{flex:1}}><Text style={styles.localTitle}>{localReady ? 'Offline engine ready' : 'Offline engine not detected'}</Text><Text style={styles.localText}>No image-processing server • no API key • no per-image fee</Text></View>
      </View>

      {!asset ? <Pressable style={styles.drop} onPress={pick}>
        <View style={styles.dropIcon}><Ionicons name="image-outline" size={34} color="#8ff0bd" /></View>
        <Text style={styles.dropTitle}>Choose a photo</Text><Text style={styles.dropText}>Your image stays on this Android device for enabled local tools.</Text>
        <View style={styles.choose}><Text style={styles.chooseText}>Browse photos</Text></View>
      </Pressable> : <>
        <BeforeAfter before={asset.uri} after={resultUri} />
        <View style={styles.actionRow}>
          <Pressable onPress={pick} style={styles.secondary}><Ionicons name="images-outline" size={18} color="#d7e4df" /><Text style={styles.secondaryText}>Change</Text></Pressable>
          {resultUri && <Pressable onPress={() => saveUri(resultUri)} style={styles.secondary}><Ionicons name="download-outline" size={18} color="#d7e4df" /><Text style={styles.secondaryText}>Save</Text></Pressable>}
        </View>
      </>}

      <Text style={styles.section}>Enhancement tools</Text>
      <View style={styles.grid}>{TOOLS.map(t => <Pressable key={t.id} onPress={() => setToolId(t.id)} style={[styles.tool, toolId===t.id && styles.toolActive, !t.available && styles.toolDisabled]}>
        <View style={[styles.toolIcon, toolId===t.id && styles.toolIconActive]}><Ionicons name={t.icon} size={21} color={toolId===t.id ? '#07140e' : t.available ? '#97eabc' : '#68746f'} /></View>
        <View style={{flex:1}}><Text style={[styles.toolName,!t.available&&{color:'#7a8681'}]}>{t.name}</Text><Text style={styles.toolEngine}>{t.engine}</Text></View>
      </Pressable>)}</View>

      <View style={styles.detailCard}>
        <View style={styles.detailHead}><Text style={styles.detailTitle}>{activeTool.name}</Text><View style={[styles.badge,!activeTool.available&&styles.badgeComing]}><Text style={[styles.badgeText,!activeTool.available&&{color:'#d6b778'}]}>{activeTool.engine}</Text></View></View>
        <Text style={styles.detailText}>{activeTool.blurb}</Text>{control()}
      </View>

      <Pressable disabled={busy || !activeTool.available} onPress={enhance} style={[styles.run, (busy || !activeTool.available) && {opacity:.5}]}> 
        {busy ? <><ActivityIndicator color="#07140e" /><Text style={styles.runText}>{toolId === 'upscale' ? `Running ${upscaleMode === 'fast' ? 'fast' : 'max-detail'} AI upscale…` : 'Processing on your phone…'}</Text></> : <><Ionicons name={activeTool.available?'sparkles':'lock-closed-outline'} size={20} color="#07140e"/><Text style={styles.runText}>{activeTool.available ? (asset ? `Run ${activeTool.name}` : 'Choose photo') : 'Offline model coming'}</Text></>}
      </Pressable>

      {history.length > 0 && <>
        <Text style={styles.section}>Recent results</Text>
        {history.map((h,i)=><Pressable onPress={() => setHistoryView(h)} style={styles.historyRow} key={`${h.at}-${i}`}>
          <Image source={{uri:h.uri}} style={styles.thumb}/>
          <View style={{flex:1}}><Text style={styles.historyName}>{h.tool}</Text><Text style={styles.historyTime}>{new Date(h.at).toLocaleTimeString()} • Tap to view</Text></View>
          <Ionicons name="chevron-forward" size={18} color="#718079" />
        </Pressable>)}
      </>}
    </ScrollView>

    <Modal visible={info} animationType="slide" transparent onRequestClose={() => setInfo(false)}>
      <View style={styles.modalShade}><View style={styles.sheet}>
        <View style={styles.sheetHead}><Text style={styles.sheetTitle}>Offline engine</Text><Pressable onPress={() => setInfo(false)}><Ionicons name="close" size={26} color="#d7e4df"/></Pressable></View>
        <View style={styles.infoRow}><Ionicons name="phone-portrait-outline" size={22} color="#8ff0bd"/><View style={{flex:1}}><Text style={styles.infoTitle}>Runs on Android</Text><Text style={styles.infoText}>Enabled tools process directly on your device instead of uploading the photo to ClarityForge servers.</Text></View></View>
        <View style={styles.infoRow}><Ionicons name="hardware-chip-outline" size={22} color="#8ff0bd"/><View style={{flex:1}}><Text style={styles.infoTitle}>Optimized local AI upscale</Text><Text style={styles.infoText}>ESRGAN now reuses its tile buffers instead of allocating thousands of temporary arrays. Fast mode also reduces the tile count for large photos.</Text></View></View>
        <View style={styles.infoRow}><Ionicons name="cash-outline" size={22} color="#8ff0bd"/><View style={{flex:1}}><Text style={styles.infoTitle}>$0 processing cost</Text><Text style={styles.infoText}>No subscription, processing server, API token or per-image credits are required.</Text></View></View>
      </View></View>
    </Modal>

    <Modal visible={!!historyView} animationType="fade" onRequestClose={() => setHistoryView(null)}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerTop}>
          <Pressable onPress={() => setHistoryView(null)} style={styles.viewerIcon}><Ionicons name="close" size={26} color="#eef7f2"/></Pressable>
          <View style={{flex:1}}><Text style={styles.viewerTitle}>{historyView?.tool || 'Result'}</Text><Text style={styles.viewerSub}>{historyView ? new Date(historyView.at).toLocaleString() : ''}</Text></View>
          <Pressable onPress={() => saveUri(historyView?.uri)} style={styles.viewerIcon}><Ionicons name="download-outline" size={24} color="#eef7f2"/></Pressable>
        </View>
        <View style={styles.viewerBody}>{historyView && <BeforeAfter before={historyView.before || historyView.uri} after={historyView.uri} height={Math.min(540, Dimensions.get('window').height - 190)} />}</View>
        <Text style={styles.viewerHint}>Drag the divider • before on the left, processed result on the right</Text>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#07100d'},topbar:{paddingHorizontal:18,paddingVertical:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#17221e'},
  brand:{fontSize:22,fontWeight:'800',color:'#f3f8f5',letterSpacing:-.5},brandAccent:{color:'#8ff0bd'},subbrand:{fontSize:9,color:'#718079',letterSpacing:2,marginTop:2},iconBtn:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:'#26342f',alignItems:'center',justifyContent:'center'},
  body:{padding:16,paddingBottom:50},localBanner:{flexDirection:'row',alignItems:'center',gap:11,padding:13,borderRadius:16,backgroundColor:'#0d1b16',borderWidth:1,borderColor:'#24362f',marginBottom:13},dot:{width:9,height:9,borderRadius:5},localTitle:{color:'#eaf5ef',fontWeight:'800',fontSize:13},localText:{color:'#82918b',fontSize:11,marginTop:2},
  drop:{height:300,borderWidth:1,borderStyle:'dashed',borderColor:'#355047',borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:'#0b1713'},dropIcon:{width:74,height:74,borderRadius:24,backgroundColor:'#10291f',alignItems:'center',justifyContent:'center',marginBottom:16},dropTitle:{fontSize:22,fontWeight:'800',color:'#f0f7f3'},dropText:{color:'#87958f',marginTop:7,marginBottom:20,textAlign:'center',paddingHorizontal:24},choose:{backgroundColor:'#8ff0bd',paddingHorizontal:22,paddingVertical:12,borderRadius:14},chooseText:{color:'#07140e',fontWeight:'800'},
  preview:{borderRadius:22,overflow:'hidden',backgroundColor:'#0b1411',borderWidth:1,borderColor:'#22322c'},afterClipRight:{position:'absolute',right:0,top:0,bottom:0,overflow:'hidden'},splitLine:{position:'absolute',top:0,bottom:0,width:2,backgroundColor:'#d8ffec'},splitDot:{position:'absolute',left:-17,width:36,height:36,borderRadius:18,backgroundColor:'#d8ffec',alignItems:'center',justifyContent:'center'},previewTag:{position:'absolute',top:8,left:8,backgroundColor:'#07100dcc',paddingHorizontal:8,paddingVertical:4,borderRadius:7},previewTagText:{fontSize:9,fontWeight:'800',letterSpacing:1,color:'#d9e7e1'},
  actionRow:{flexDirection:'row',gap:10,marginTop:10},secondary:{flexDirection:'row',gap:7,alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#2a3b35',borderRadius:12},secondaryText:{color:'#d7e4df',fontWeight:'700'},section:{fontSize:13,fontWeight:'800',textTransform:'uppercase',letterSpacing:1.4,color:'#83928c',marginTop:26,marginBottom:12},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},tool:{width:(W-42)/2,padding:12,borderWidth:1,borderColor:'#1e2b27',borderRadius:17,backgroundColor:'#0b1512',flexDirection:'row',gap:10,alignItems:'center'},toolActive:{borderColor:'#5cae83',backgroundColor:'#102119'},toolDisabled:{opacity:.68},toolIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#12231c',alignItems:'center',justifyContent:'center'},toolIconActive:{backgroundColor:'#8ff0bd'},toolName:{color:'#e3ece8',fontSize:13,fontWeight:'700'},toolEngine:{fontSize:8,letterSpacing:1.1,fontWeight:'900',color:'#70827a',marginTop:2},
  detailCard:{marginTop:16,padding:17,borderRadius:20,borderWidth:1,borderColor:'#24342e',backgroundColor:'#0c1713'},detailHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},detailTitle:{fontSize:19,fontWeight:'800',color:'#f3f7f5',flex:1},detailText:{color:'#92a19b',lineHeight:20,marginTop:7},badge:{backgroundColor:'#123023',borderRadius:8,paddingHorizontal:8,paddingVertical:5},badgeComing:{backgroundColor:'#2c2718'},badgeText:{color:'#8ff0bd',fontSize:8,fontWeight:'900',letterSpacing:1},controlBox:{marginTop:18},controlHeader:{flexDirection:'row',justifyContent:'space-between'},controlLabel:{color:'#d4e1dc',fontWeight:'700',marginBottom:11},controlValue:{color:'#8ff0bd',fontWeight:'800'},smallHelp:{color:'#708079',fontSize:11,lineHeight:16,marginTop:10},
  slider:{height:18,backgroundColor:'#1c2924',borderRadius:9,justifyContent:'center'},sliderFill:{position:'absolute',height:6,backgroundColor:'#8ff0bd',borderRadius:6},sliderKnob:{position:'absolute',marginLeft:-9,width:18,height:18,borderRadius:9,backgroundColor:'#e8fff4'},segmentRow:{flexDirection:'row',gap:10},segment:{flex:1,padding:12,alignItems:'center',backgroundColor:'#14201c',borderRadius:12},segmentActive:{backgroundColor:'#2d6648'},segmentText:{color:'#e9f6f0',fontWeight:'800'},segmentSub:{color:'#a5b8af',fontSize:9,marginTop:2,fontWeight:'700'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},pill:{paddingHorizontal:10,paddingVertical:9,borderRadius:10,backgroundColor:'#15201c'},pillActive:{backgroundColor:'#2c6547'},pillText:{color:'#e3eee9',fontSize:11,fontWeight:'700',textTransform:'capitalize'},
  run:{marginTop:14,minHeight:54,borderRadius:16,backgroundColor:'#8ff0bd',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9},runText:{color:'#07140e',fontWeight:'900',fontSize:14},historyRow:{flexDirection:'row',alignItems:'center',gap:12,padding:9,marginBottom:7,borderRadius:14,backgroundColor:'#0b1612',borderWidth:1,borderColor:'#1f2e29'},thumb:{width:58,height:58,borderRadius:12,backgroundColor:'#16201c'},historyName:{color:'#dce8e3',fontWeight:'800'},historyTime:{color:'#73827c',fontSize:11,marginTop:3},
  modalShade:{flex:1,backgroundColor:'#0009',justifyContent:'flex-end'},sheet:{backgroundColor:'#0a1411',borderTopLeftRadius:25,borderTopRightRadius:25,padding:20,paddingBottom:36,borderWidth:1,borderColor:'#25342f'},sheetHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:18},sheetTitle:{fontSize:22,fontWeight:'900',color:'#eff7f3'},infoRow:{flexDirection:'row',gap:12,marginBottom:18},infoTitle:{color:'#e9f2ee',fontWeight:'800',fontSize:14},infoText:{color:'#86958f',lineHeight:19,marginTop:3,fontSize:12},
  viewer:{flex:1,backgroundColor:'#050b09'},viewerTop:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderBottomWidth:1,borderBottomColor:'#1d2925'},viewerIcon:{width:44,height:44,borderRadius:14,backgroundColor:'#101b17',alignItems:'center',justifyContent:'center'},viewerTitle:{color:'#eff7f3',fontWeight:'900',fontSize:17},viewerSub:{color:'#718079',fontSize:10,marginTop:2},viewerBody:{flex:1,justifyContent:'center',padding:16},viewerHint:{color:'#82918b',fontSize:11,textAlign:'center',paddingBottom:20}
});
