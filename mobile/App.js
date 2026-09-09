import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, Modal, PanResponder, Pressable,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOOLS } from './src/tools';
import { processImage } from './src/api';

const W = Dimensions.get('window').width;
const DEFAULT_SERVER = 'http://192.168.1.2:8000';

function Slider({ value, min = 0, max = 100, onChange }) {
  const width = W - 72;
  function setFromX(x) {
    const p = Math.max(0, Math.min(1, x / width));
    onChange(Math.round(min + p * (max - min)));
  }
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

function BeforeAfter({ before, after }) {
  const [split, setSplit] = useState(52);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: e => setSplit(Math.max(4, Math.min(96, (e.nativeEvent.locationX / (W - 32)) * 100)))
  }), []);
  return <View style={styles.preview} {...pan.panHandlers}>
    <Image source={{ uri: before }} style={StyleSheet.absoluteFill} resizeMode="contain" />
    {after && <View style={[styles.afterClip, { width: `${split}%` }]}>
      <Image source={{ uri: after }} style={{ width: W - 32, height: 330 }} resizeMode="contain" />
    </View>}
    {after && <View style={[styles.splitLine, { left: `${split}%` }]}><View style={styles.splitDot}><Ionicons name="swap-horizontal" size={18} color="#08100d" /></View></View>}
    <View style={styles.previewTag}><Text style={styles.previewTagText}>BEFORE</Text></View>
    {after && <View style={[styles.previewTag, { right: 8, left: undefined }]}><Text style={styles.previewTagText}>AFTER</Text></View>}
  </View>;
}

export default function App() {
  const [asset, setAsset] = useState(null);
  const [resultUri, setResultUri] = useState(null);
  const [toolId, setToolId] = useState('autopilot');
  const [strength, setStrength] = useState(55);
  const [creativity, setCreativity] = useState(35);
  const [scale, setScale] = useState(2);
  const [lighting, setLighting] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [settings, setSettings] = useState(false);
  const [history, setHistory] = useState([]);
  const activeTool = TOOLS.find(t => t.id === toolId);

  useEffect(() => { AsyncStorage.getItem('serverUrl').then(v => v && setServerUrl(v)); }, []);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled) { setAsset(res.assets[0]); setResultUri(null); }
  }

  async function enhance() {
    if (!asset) return pick();
    setBusy(true);
    try {
      const params = { strength: strength / 100, creativity: creativity / 100, scale, lighting };
      const blob = await processImage(serverUrl, asset, toolId, params);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];
          const ext = toolId === 'background' ? 'png' : 'jpg';
          const path = `${FileSystem.cacheDirectory}clarityforge-${Date.now()}.${ext}`;
          await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
          setResultUri(path);
          setHistory(h => [{ tool: activeTool.name, uri: path, at: new Date().toISOString() }, ...h].slice(0, 10));
        } catch (e) {
          Alert.alert('Processing failed', e.message);
        } finally {
          setBusy(false);
        }
      };
      reader.onerror = () => { setBusy(false); Alert.alert('Processing failed', 'Could not read the processed image.'); };
      reader.readAsDataURL(blob);
    } catch (e) {
      setBusy(false);
      Alert.alert('Processing failed', `${e.message}\n\nOpen Settings and enter the address of your ClarityForge processing server.`);
    }
  }

  async function save() {
    if (!resultUri) return;
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Photo-library permission is required to save the result.');
    await MediaLibrary.saveToLibraryAsync(resultUri);
    Alert.alert('Saved', 'Enhanced image saved to your photo library.');
  }

  async function saveServer() {
    await AsyncStorage.setItem('serverUrl', serverUrl.trim());
    setSettings(false);
  }

  function control() {
    if (!activeTool?.control) return null;
    if (activeTool.control === 'scale') return <View style={styles.controlBox}><Text style={styles.controlLabel}>Scale</Text><View style={styles.segmentRow}>{[2,4].map(n => <Pressable key={n} onPress={() => setScale(n)} style={[styles.segment, scale===n && styles.segmentActive]}><Text style={styles.segmentText}>{n}×</Text></Pressable>)}</View></View>;
    if (activeTool.control === 'lighting') return <View style={styles.controlBox}><Text style={styles.controlLabel}>Lighting issue</Text><View style={styles.wrap}>{['underexposed','overexposed','low_contrast','balanced'].map(v => <Pressable key={v} onPress={() => setLighting(v)} style={[styles.pill, lighting===v && styles.pillActive]}><Text style={styles.pillText}>{v.replace('_',' ')}</Text></Pressable>)}</View></View>;
    const isCreative = activeTool.control === 'creativity';
    const val = isCreative ? creativity : strength;
    const set = isCreative ? setCreativity : setStrength;
    return <View style={styles.controlBox}><View style={styles.controlHeader}><Text style={styles.controlLabel}>{isCreative ? 'Creativity' : 'Strength'}</Text><Text style={styles.controlValue}>{val}%</Text></View><Slider value={val} onChange={set} /></View>;
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" />
    <View style={styles.topbar}>
      <View><Text style={styles.brand}>ClarityForge <Text style={styles.brandAccent}>AI</Text></Text><Text style={styles.subbrand}>PHOTO ENHANCEMENT LAB</Text></View>
      <Pressable onPress={() => setSettings(true)} style={styles.iconBtn}><Ionicons name="settings-outline" size={23} color="#d7e4df" /></Pressable>
    </View>

    <ScrollView contentContainerStyle={styles.body}>
      {!asset ? <Pressable style={styles.drop} onPress={pick}>
        <View style={styles.dropIcon}><Ionicons name="image-outline" size={34} color="#8ff0bd" /></View>
        <Text style={styles.dropTitle}>Choose a photo</Text><Text style={styles.dropText}>JPEG, PNG or HEIC from your Android photo library</Text>
        <View style={styles.choose}><Text style={styles.chooseText}>Browse photos</Text></View>
      </Pressable> : <>
        <BeforeAfter before={asset.uri} after={resultUri} />
        <View style={styles.actionRow}>
          <Pressable onPress={pick} style={styles.secondary}><Ionicons name="images-outline" size={18} color="#d7e4df" /><Text style={styles.secondaryText}>Change</Text></Pressable>
          {resultUri && <Pressable onPress={save} style={styles.secondary}><Ionicons name="download-outline" size={18} color="#d7e4df" /><Text style={styles.secondaryText}>Save</Text></Pressable>}
        </View>
      </>}

      <Text style={styles.section}>Enhancement tools</Text>
      <View style={styles.grid}>{TOOLS.map(t => <Pressable key={t.id} onPress={() => setToolId(t.id)} style={[styles.tool, toolId===t.id && styles.toolActive]}>
        <View style={[styles.toolIcon, toolId===t.id && styles.toolIconActive]}><Ionicons name={t.icon} size={21} color={toolId===t.id ? '#07140e' : '#97eabc'} /></View>
        <Text style={styles.toolName}>{t.name}</Text>
      </Pressable>)}</View>

      <View style={styles.detailCard}><View style={styles.detailHead}><Text style={styles.detailTitle}>{activeTool.name}</Text><View style={styles.badge}><Text style={styles.badgeText}>OPEN ENGINE</Text></View></View><Text style={styles.detailText}>{activeTool.blurb}</Text>{control()}</View>

      <Pressable disabled={busy} onPress={enhance} style={[styles.run, busy && {opacity:.65}]}> {busy ? <ActivityIndicator color="#07140e" /> : <><Ionicons name="sparkles" size={20} color="#07140e"/><Text style={styles.runText}>{asset ? `Run ${activeTool.name}` : 'Choose photo'}</Text></>}</Pressable>

      {history.length > 0 && <><Text style={styles.section}>Recent results</Text>{history.map((h,i)=><View style={styles.historyRow} key={i}><Image source={{uri:h.uri}} style={styles.thumb}/><View><Text style={styles.historyName}>{h.tool}</Text><Text style={styles.historyTime}>{new Date(h.at).toLocaleTimeString()}</Text></View></View>)}</>}
    </ScrollView>

    <Modal visible={settings} animationType="slide" transparent>
      <View style={styles.modalShade}><View style={styles.sheet}>
        <View style={styles.sheetHead}><Text style={styles.sheetTitle}>Settings</Text><Pressable onPress={() => setSettings(false)}><Ionicons name="close" size={26} color="#d7e4df"/></Pressable></View>
        <Text style={styles.inputLabel}>Processing server</Text>
        <TextInput value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" keyboardType="url" style={styles.input} placeholder="https://your-server.example" placeholderTextColor="#68736f"/>
        <Text style={styles.help}>ClarityForge sends the selected image to this server for AI processing. Use an HTTPS cloud server or the LAN address of a computer running ClarityForge Server.</Text>
        <Pressable onPress={saveServer} style={styles.run}><Text style={styles.runText}>Save settings</Text></Pressable>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#07100d'}, topbar:{paddingHorizontal:18,paddingVertical:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#17221e'},
  brand:{fontSize:22,fontWeight:'800',color:'#f3f8f5',letterSpacing:-.5},brandAccent:{color:'#8ff0bd'},subbrand:{fontSize:9,color:'#65736d',letterSpacing:2.1,marginTop:2},iconBtn:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:'#26342f',alignItems:'center',justifyContent:'center'},
  body:{padding:16,paddingBottom:50},drop:{height:315,borderWidth:1,borderStyle:'dashed',borderColor:'#355047',borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:'#0b1713'},dropIcon:{width:74,height:74,borderRadius:24,backgroundColor:'#10291f',alignItems:'center',justifyContent:'center',marginBottom:16},dropTitle:{fontSize:22,fontWeight:'800',color:'#f0f7f3'},dropText:{color:'#87958f',marginTop:7,marginBottom:20,textAlign:'center'},choose:{backgroundColor:'#8ff0bd',paddingHorizontal:22,paddingVertical:12,borderRadius:14},chooseText:{color:'#07140e',fontWeight:'800'},
  preview:{height:330,borderRadius:22,overflow:'hidden',backgroundColor:'#0b1411',borderWidth:1,borderColor:'#22322c'},afterClip:{height:330,overflow:'hidden'},splitLine:{position:'absolute',top:0,bottom:0,width:2,backgroundColor:'#d8ffec'},splitDot:{position:'absolute',top:145,left:-17,width:36,height:36,borderRadius:18,backgroundColor:'#d8ffec',alignItems:'center',justifyContent:'center'},previewTag:{position:'absolute',top:8,left:8,backgroundColor:'#07100dcc',paddingHorizontal:8,paddingVertical:4,borderRadius:7},previewTagText:{fontSize:9,fontWeight:'800',letterSpacing:1,color:'#d9e7e1'},
  actionRow:{flexDirection:'row',gap:10,marginTop:10},secondary:{flexDirection:'row',gap:7,alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#2a3b35',borderRadius:12},secondaryText:{color:'#d7e4df',fontWeight:'700'},section:{fontSize:13,fontWeight:'800',textTransform:'uppercase',letterSpacing:1.4,color:'#83928c',marginTop:26,marginBottom:12},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},tool:{width:(W-42)/2,padding:13,borderWidth:1,borderColor:'#1e2b27',borderRadius:17,backgroundColor:'#0b1512',flexDirection:'row',gap:11,alignItems:'center'},toolActive:{borderColor:'#5cae83',backgroundColor:'#102119'},toolIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#12231c',alignItems:'center',justifyContent:'center'},toolIconActive:{backgroundColor:'#8ff0bd'},toolName:{flex:1,color:'#e3ece8',fontSize:13,fontWeight:'700'},
  detailCard:{marginTop:16,padding:17,borderRadius:20,borderWidth:1,borderColor:'#24342e',backgroundColor:'#0c1713'},detailHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},detailTitle:{fontSize:19,fontWeight:'800',color:'#f3f7f5'},detailText:{color:'#92a19b',lineHeight:20,marginTop:7},badge:{backgroundColor:'#123023',borderRadius:8,paddingHorizontal:8,paddingVertical:5},badgeText:{color:'#8ff0bd',fontSize:8,fontWeight:'900',letterSpacing:1},controlBox:{marginTop:18},controlHeader:{flexDirection:'row',justifyContent:'space-between'},controlLabel:{color:'#d4e1dc',fontWeight:'700',marginBottom:11},controlValue:{color:'#8ff0bd',fontWeight:'800'},slider:{height:18,backgroundColor:'#1c2924',borderRadius:9,justifyContent:'center'},sliderFill:{position:'absolute',height:6,backgroundColor:'#8ff0bd',borderRadius:6},sliderKnob:{position:'absolute',marginLeft:-9,width:18,height:18,borderRadius:9,backgroundColor:'#e8fff4'},segmentRow:{flexDirection:'row',gap:10},segment:{flex:1,padding:12,alignItems:'center',backgroundColor:'#14201c',borderRadius:12},segmentActive:{backgroundColor:'#2d6648'},segmentText:{color:'#e9f6f0',fontWeight:'800'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},pill:{paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:'#14201c'},pillActive:{backgroundColor:'#2d6648'},pillText:{color:'#e7f2ed',textTransform:'capitalize'},
  run:{marginTop:16,height:54,borderRadius:16,backgroundColor:'#8ff0bd',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9},runText:{color:'#07140e',fontWeight:'900',fontSize:15},historyRow:{flexDirection:'row',alignItems:'center',gap:12,padding:10,borderBottomWidth:1,borderBottomColor:'#1d2925'},thumb:{width:54,height:54,borderRadius:12},historyName:{color:'#e9f1ee',fontWeight:'700'},historyTime:{color:'#708079',fontSize:12,marginTop:3},
  modalShade:{flex:1,backgroundColor:'#0009',justifyContent:'flex-end'},sheet:{backgroundColor:'#0a1511',borderTopLeftRadius:26,borderTopRightRadius:26,padding:20,paddingBottom:40,borderWidth:1,borderColor:'#22332c'},sheetHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:24},sheetTitle:{fontSize:24,color:'#f2f7f4',fontWeight:'800'},inputLabel:{fontSize:12,color:'#91a099',fontWeight:'800',textTransform:'uppercase',letterSpacing:1},input:{marginTop:8,borderWidth:1,borderColor:'#31443c',backgroundColor:'#101d18',borderRadius:14,paddingHorizontal:14,paddingVertical:13,color:'#eff8f4'},help:{color:'#7f8e88',lineHeight:19,marginTop:10,fontSize:12}
});
