import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart } from "react-native-chart-kit";
import {
  collection, getDocs, query, where, Timestamp,
} from "firebase/firestore";
import { db }             from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useFocusEffect } from "@react-navigation/native";
import { BackHeader }    from "../../components/ui/BackHeader";
import { ThemedCard }    from "../../components/ui/ThemedCard";
import { ScreenWrapper } from "../../components/ui/ScreenWrapper";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48;

interface ServicioRealizado {
  precio:           number;
  servicio:         string;
  fecha:            Timestamp;
  estado?:          string;
  modalidadPago?:   string;
  peluqueroUid?:    string;
  peluqueroNombre?: string;
}
interface PedidoAprobado {
  total:     number;
  fecha:     Timestamp;
  createdAt: Timestamp;
  estado:    string;
  items:     { nombre: string; cantidad: number; precio: number; categoria?: string }[];
}
interface ClienteDeuda {
  saldo: number;
}

const PERIODOS = ["Hoy","7 días","30 días","Mes","Este año"] as const;
type Periodo = typeof PERIODOS[number];
type Vista   = "todo" | "peluqueria" | "tienda";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function AdminBalancesScreen() {
  const c = useThemeColors();
  const [servicios,     setServicios]     = useState<ServicioRealizado[]>([]);
  const [pedidos,       setPedidos]       = useState<PedidoAprobado[]>([]);
  const [creditoTotal,  setCreditoTotal]  = useState(0);
  const [peluqueros,    setPeluqueros]    = useState<{uid:string;nombre:string}[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [periodo,       setPeriodo]       = useState<Periodo>("Hoy");
  const [mesSelec,      setMesSelec]      = useState<number>(new Date().getMonth());
  const [anioSelec,     setAnioSelec]     = useState<number>(new Date().getFullYear());
  const [vista,         setVista]         = useState<Vista>("todo");
  const [peluqueroFil,  setPeluqueroFil]  = useState<string>("todos");

  const loadData = async () => {
    setLoading(true);
    // Query each collection independently so one failure doesn't block others
    try {
      const servSnap = await getDocs(collection(db, "servicios_realizados"));
      const servData = servSnap.docs
        .map(d => d.data() as ServicioRealizado)
        .sort((a,b) => {
          try { return a.fecha.toMillis() - b.fecha.toMillis(); } catch { return 0; }
        });
      setServicios(servData);
    } catch {}

    try {
      const pedSnap = await getDocs(collection(db, "pedidos"));
      setPedidos(pedSnap.docs
        .map(d => d.data() as PedidoAprobado)
        .sort((a,b) => {
          try { return (a.createdAt??a.fecha).toMillis()-(b.createdAt??b.fecha).toMillis(); } catch { return 0; }
        })
      );
    } catch {}

    try {
      const credSnap = await getDocs(
        query(collection(db,"users"), where("role","==","cliente"))
      );
      const total = credSnap.docs.reduce((acc,d)=>acc+(d.data().saldo??0),0);
      setCreditoTotal(total);
    } catch {}

    try {
      const pelSnap = await getDocs(
        query(collection(db,"users"), where("role","in",["empleado","admin"]))
      );
      setPeluqueros(pelSnap.docs.map(d => ({
        uid: d.id,
        nombre: `${d.data().nombre} ${d.data().apellido}`,
      })));
    } catch {}

    setLoading(false);
  };

  // Load on mount
  useEffect(() => { loadData(); }, []);
  // Reload when screen comes into focus
  useFocusEffect(useCallback(() => { loadData(); }, []));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const ahora = new Date();
  const enPeriodo = (ts: any) => {
    try {
      const f = ts?.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(f.getTime())) return false; // excluir registros con fecha inválida
      if (periodo === "Hoy")     { return f.getFullYear()===ahora.getFullYear() && f.getMonth()===ahora.getMonth() && f.getDate()===ahora.getDate(); }
      if (periodo === "7 días")  { const d=new Date(ahora); d.setDate(ahora.getDate()-7);  return f>=d; }
      if (periodo === "30 días") { const d=new Date(ahora); d.setDate(ahora.getDate()-30); return f>=d; }
      if (periodo === "Mes")     { return f.getFullYear()===anioSelec && f.getMonth()===mesSelec; }
      return f.getFullYear()===ahora.getFullYear();
    } catch { return false; } // excluir si hay error parseando la fecha
  };

  const servFiltBase = servicios
    .filter(s=>enPeriodo(s.fecha))
    .filter(s=>!s.estado || s.estado==="completado");
  const servFilt = vista==="peluqueria" && peluqueroFil!=="todos"
    ? servFiltBase.filter(s=>s.peluqueroUid===peluqueroFil)
    : servFiltBase;
  const pedFilt  = pedidos.filter(p=>
    enPeriodo(p.createdAt??p.fecha) &&
    ["aprobado","entregado"].includes(p.estado)
  );

  // KPIs
  const ingServicios = servFilt.reduce((a,s)=>a+(s.precio??0),0);
  const ingTienda    = pedFilt.reduce((a,p)=>a+(p.total??0),0);
  const ticketProm   = servFilt.length>0 ? Math.round(ingServicios/servFilt.length) : 0;

  // Contado vs crédito en servicios
  const ingContado = servFilt.filter(s=>s.modalidadPago==="contado").reduce((a,s)=>a+(s.precio??0),0);
  const ingCredito = servFilt.filter(s=>s.modalidadPago==="credito").reduce((a,s)=>a+(s.precio??0),0);

  // Total en caja = solo servicios cobrados (contado) + tienda
  const ingTotal = ingContado + ingTienda;

  // Gráfica
  const buildBarData = () => {
    const source = vista==="tienda" ? [] : servFilt;
    if (periodo==="Hoy") {
      const horas=[0,0,0,0,0,0];
      const labs=["8-10","10-12","12-14","14-16","16-18","18+"];
      source.forEach(s=>{
        const h=s.fecha.toDate().getHours();
        const idx=h<10?0:h<12?1:h<14?2:h<16?3:h<18?4:5;
        horas[idx]+=(s.precio??0);
      });
      return { labels:labs, datasets:[{data:horas}] };
    }
    if (periodo==="Este año") {
      const m=Array(12).fill(0);
      source.forEach(s=>{m[s.fecha.toDate().getMonth()]+=(s.precio??0);});
      return { labels:MESES, datasets:[{data:m}] };
    }
    if (periodo==="Mes") {
      const sem=[0,0,0,0];
      source.forEach(s=>{
        const f=s.fecha.toDate();
        if(f.getFullYear()===anioSelec&&f.getMonth()===mesSelec){
          sem[Math.min(3,Math.floor((f.getDate()-1)/7))]+=(s.precio??0);
        }
      });
      return { labels:["Sem 1","Sem 2","Sem 3","Sem 4"], datasets:[{data:sem}] };
    }
    if (periodo==="30 días") {
      const sem=[0,0,0,0];
      source.forEach(s=>{
        const d=Math.floor((ahora.getTime()-s.fecha.toDate().getTime())/86400000);
        sem[Math.min(3,Math.floor(d/7))]+=(s.precio??0);
      });
      return { labels:["Sem 1","Sem 2","Sem 3","Sem 4"], datasets:[{data:sem}] };
    }
    const dias=Array(7).fill(0);
    const labs=[];
    for(let i=6;i>=0;i--){const d=new Date(ahora);d.setDate(ahora.getDate()-i);labs.push(["D","L","M","X","J","V","S"][d.getDay()]);}
    source.forEach(s=>{const d=Math.floor((ahora.getTime()-s.fecha.toDate().getTime())/86400000);if(d<7)dias[6-d]+=(s.precio??0);});
    return { labels:labs, datasets:[{data:dias}] };
  };

  // Top servicios
  const topServ: Record<string,number>={};
  servFilt.forEach(s=>{topServ[s.servicio]=(topServ[s.servicio]??0)+(s.precio??0);});
  const topServSorted = Object.entries(topServ).sort(([,a],[,b])=>b-a).slice(0,4);

  // Top productos
  const topProd: Record<string,number>={};
  pedFilt.forEach(p=>p.items?.forEach(i=>{topProd[i.nombre]=(topProd[i.nombre]??0)+i.precio*i.cantidad;}));
  const topProdSorted = Object.entries(topProd).sort(([,a],[,b])=>b-a).slice(0,4);

  // Por empleado
  const porEmp: Record<string,{uid:string;nombre:string;total:number;citas:number}>={};
  servFilt.forEach(s=>{
    const uid=s.peluqueroUid??"sin_asignar";
    if(!porEmp[uid]) porEmp[uid]={uid,nombre:s.peluqueroNombre??"Sin asignar",total:0,citas:0};
    porEmp[uid].total+=(s.precio??0);
    porEmp[uid].citas+=1;
  });
  const empSorted = Object.values(porEmp).sort((a,b)=>b.total-a.total);

  const barData = buildBarData();
  const chartConfig = {
    backgroundGradientFrom: c.surface, backgroundGradientTo: c.surface,
    color:(o=1)=>`rgba(242,185,12,${o})`, labelColor:()=>c.sub,
    strokeWidth:2, barPercentage:0.6, decimalPlaces:0,
    propsForLabels:{fontFamily:"SpaceGrotesk_500Medium",fontSize:10},
  };

  const showPeluqueria = vista==="todo" || vista==="peluqueria";
  const showTienda     = vista==="todo" || vista==="tienda";

  return (
    <ScreenWrapper keyboard={false}>
      <BackHeader title="Balances" />
      {loading ? <ActivityIndicator color={c.amber} style={{marginTop:40}}/> : (
        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber}/>}
        >
          {/* Periodo */}
          <View style={[styles.segRow,{backgroundColor:c.surface,borderColor:c.border}]}>
            {PERIODOS.map(p=>(
              <TouchableOpacity key={p} onPress={()=>setPeriodo(p)}
                style={[styles.segBtn, periodo===p&&{backgroundColor:c.amber}]}>
                <Text style={[styles.segTxt,{color:periodo===p?"#000":c.sub}]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selector mes/año (solo cuando periodo = "Mes") */}
          {periodo === "Mes" && (
            <View style={{ gap: 8 }}>
              {/* Año */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setAnioSelec(a => a - 1)}
                  style={[styles.anioBtn, { borderColor: c.border }]}
                >
                  <MaterialIcons name="chevron-left" size={20} color={c.text} />
                </TouchableOpacity>
                <Text style={[styles.anioTxt, { color: c.text }]}>{anioSelec}</Text>
                <TouchableOpacity
                  onPress={() => setAnioSelec(a => Math.min(a + 1, ahora.getFullYear()))}
                  style={[styles.anioBtn, { borderColor: c.border }]}
                >
                  <MaterialIcons name="chevron-right" size={20} color={c.text} />
                </TouchableOpacity>
              </View>
              {/* Meses */}
              <View style={styles.mesesGrid}>
                {MESES.map((m, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setMesSelec(i)}
                    style={[styles.mesBtn, {
                      borderColor: mesSelec === i ? c.amber : c.border,
                      backgroundColor: mesSelec === i ? c.amber + "22" : "transparent",
                    }]}
                  >
                    <Text style={[styles.mesBtnTxt, { color: mesSelec === i ? c.amber : c.sub }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Vista tienda/peluquería */}
          <View style={[styles.segRow,{backgroundColor:c.surface,borderColor:c.border}]}>
            {([["todo","Todo"],["peluqueria","Peluquería"],["tienda","Tienda"]] as const).map(([k,l])=>(
              <TouchableOpacity key={k} onPress={()=>setVista(k)}
                style={[styles.segBtn, vista===k&&{backgroundColor:c.blue}]}>
                <Text style={[styles.segTxt,{color:vista===k?"#fff":c.sub}]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtro peluquero - cuando vista es peluqueria */}
          {vista === "peluqueria" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{gap:8}}>
              <TouchableOpacity
                onPress={() => setPeluqueroFil("todos")}
                style={{paddingHorizontal:12,paddingVertical:6,borderRadius:20,borderWidth:1,
                  borderColor:peluqueroFil==="todos"?c.blue:c.border,
                  backgroundColor:peluqueroFil==="todos"?c.blue+"22":"transparent"}}>
                <Text style={{fontSize:11,fontFamily:"SpaceGrotesk_600SemiBold",
                  color:peluqueroFil==="todos"?c.blue:c.sub}}>Todos</Text>
              </TouchableOpacity>
              {peluqueros.map((e,i)=>(
                <TouchableOpacity key={i}
                  onPress={() => setPeluqueroFil(e.uid)}
                  style={{paddingHorizontal:12,paddingVertical:6,borderRadius:20,borderWidth:1,
                    borderColor:peluqueroFil===e.uid?c.blue:c.border,
                    backgroundColor:peluqueroFil===e.uid?c.blue+"22":"transparent"}}>
                  <Text style={{fontSize:11,fontFamily:"SpaceGrotesk_600SemiBold",
                    color:peluqueroFil===e.uid?c.blue:c.sub}}>{e.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* KPIs */}
          <Text style={[styles.sec,{color:c.sub}]}>RESUMEN</Text>
          <View style={styles.kpiRow}>
            <ThemedCard style={styles.kpi}>
              <MaterialIcons name="trending-up" size={16} color={c.sub}/>
              <Text style={[styles.kpiL,{color:c.sub}]}>Caja</Text>
              <Text style={[styles.numSobrio,{color:c.positive}]}>${(showPeluqueria&&showTienda?ingTotal:showPeluqueria?ingContado:ingTienda).toLocaleString("es-CO")}</Text>
            </ThemedCard>
            {showPeluqueria&&(
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="content-cut" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Servicios</Text>
                <Text style={[styles.numSobrio,{color:c.positive}]}>${ingServicios.toLocaleString("es-CO")}</Text>
              </ThemedCard>
            )}
            {showTienda&&(
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="store" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Tienda</Text>
                <Text style={[styles.numSobrio,{color:c.positive}]}>${ingTienda.toLocaleString("es-CO")}</Text>
              </ThemedCard>
            )}
          </View>

          {showPeluqueria&&(
            <View style={styles.kpiRow}>
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="event" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Citas</Text>
                <Text style={[styles.numSobrio,{color:c.text}]}>{servFilt.length}</Text>
              </ThemedCard>
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="receipt" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Ticket prom.</Text>
                <Text style={[styles.numSobrio,{color:c.text}]}>${ticketProm.toLocaleString("es-CO")}</Text>
              </ThemedCard>
              <ThemedCard style={styles.kpi}>
                <MaterialIcons name="payments" size={16} color={c.sub}/>
                <Text style={[styles.kpiL,{color:c.sub}]}>Crédito</Text>
                <Text style={[styles.numSobrio,{color:c.negative}]}>${ingCredito.toLocaleString("es-CO")}</Text>
              </ThemedCard>
            </View>
          )}

          {/* Créditos pendientes */}
          {creditoTotal>0&&(
            <ThemedCard style={[styles.creditCard,{borderColor:c.negative+"44",backgroundColor:c.negative+"0A"}]}>
              <MaterialIcons name="credit-card" size={18} color={c.negative}/>
              <View style={{flex:1}}>
                <Text style={[styles.kpiL,{color:c.sub}]}>CRÉDITOS PENDIENTES CLIENTES</Text>
                <Text style={[styles.numSobrio,{color:c.negative}]}>${creditoTotal.toLocaleString("es-CO")}</Text>
              </View>
            </ThemedCard>
          )}

          {ingTotal===0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="bar-chart" size={52} color={c.sub}/>
              <Text style={[styles.emptyT,{color:c.text}]}>Sin datos aún</Text>
              <Text style={[styles.emptyD,{color:c.sub}]}>Los ingresos aparecen cuando se completen servicios o se aprueben pedidos</Text>
            </View>
          ) : (<>

            {/* Gráfica servicios */}
            {showPeluqueria&&servFilt.length>0&&(<>
              <Text style={[styles.sec,{color:c.sub}]}>INGRESOS SERVICIOS</Text>
              <ThemedCard style={{padding:8}}>
                <BarChart data={barData} width={CHART_W} height={180} chartConfig={chartConfig}
                  style={{borderRadius:12}} showValuesOnTopOfBars fromZero yAxisLabel="$" yAxisSuffix=""/>
              </ThemedCard>
              <Text style={[styles.sec,{color:c.sub}]}>TOP SERVICIOS</Text>
              {topServSorted.map(([n,t],i)=>{
                const pct=ingServicios>0?(t/ingServicios)*100:0;
                return(
                  <ThemedCard key={i} style={styles.topCard}>
                    <View style={styles.topRow}>
                      <Text style={[styles.topN,{color:c.text}]}>{n}</Text>
                      <Text style={[styles.topNum,{color:c.amber}]}>${t.toLocaleString("es-CO")}</Text>
                    </View>
                    <View style={[styles.barBg,{backgroundColor:c.border}]}>
                      <View style={[styles.barFill,{width:`${pct}%`,backgroundColor:c.amber}]}/>
                    </View>
                    <Text style={[styles.topP,{color:c.sub}]}>{pct.toFixed(1)}%</Text>
                  </ThemedCard>
                );
              })}
            </>)}

            {/* Tienda */}
            {showTienda&&pedFilt.length>0&&(<>
              <Text style={[styles.sec,{color:c.sub}]}>VENTAS TIENDA</Text>
              <View style={styles.kpiRow}>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="shopping-bag" size={16} color={c.sub}/>
                  <Text style={[styles.kpiL,{color:c.sub}]}>Total</Text>
                  <Text style={[styles.numSobrio,{color:c.positive}]}>${ingTienda.toLocaleString("es-CO")}</Text>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="inventory" size={16} color={c.sub}/>
                  <Text style={[styles.kpiL,{color:c.sub}]}>Pedidos</Text>
                  <Text style={[styles.numSobrio,{color:c.text}]}>{pedFilt.length}</Text>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="receipt" size={16} color={c.sub}/>
                  <Text style={[styles.kpiL,{color:c.sub}]}>Prom.</Text>
                  <Text style={[styles.numSobrio,{color:c.positive}]}>${Math.round(ingTienda/pedFilt.length).toLocaleString("es-CO")}</Text>
                </ThemedCard>
              </View>
              {topProdSorted.length>0&&(<>
                <Text style={[styles.sec,{color:c.sub}]}>TOP PRODUCTOS</Text>
                {topProdSorted.map(([n,t],i)=>{
                  const pct=ingTienda>0?(t/ingTienda)*100:0;
                  return(
                    <ThemedCard key={i} style={styles.topCard}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topN,{color:c.text}]}>{n}</Text>
                        <Text style={[styles.topNum,{color:c.positive}]}>${t.toLocaleString("es-CO")}</Text>
                      </View>
                      <View style={[styles.barBg,{backgroundColor:c.border}]}>
                        <View style={[styles.barFill,{width:`${pct}%`,backgroundColor:c.positive}]}/>
                      </View>
                      <Text style={[styles.topP,{color:c.sub}]}>{pct.toFixed(1)}%</Text>
                    </ThemedCard>
                  );
                })}
              </>)}
            </>)}

            {/* Por empleado */}
            {showPeluqueria&&empSorted.length>0&&(<>
              <Text style={[styles.sec,{color:c.sub}]}>POR EMPLEADO</Text>
              {empSorted.map((e,i)=>{
                const pct=ingServicios>0?(e.total/ingServicios)*100:0;
                return(
                  <ThemedCard key={i} style={styles.empCard}>
                    <View style={[styles.empAv,{backgroundColor:c.blue+"22"}]}>
                      <Text style={[styles.empAvT,{color:c.blue}]}>
                        {e.nombre.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{flex:1,gap:6}}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topN,{color:c.text}]}>{e.nombre}</Text>
                        <Text style={[styles.topNum,{color:c.blue}]}>${e.total.toLocaleString("es-CO")}</Text>
                      </View>
                      <View style={[styles.barBg,{backgroundColor:c.border}]}>
                        <View style={[styles.barFill,{width:`${pct}%`,backgroundColor:c.blue}]}/>
                      </View>
                      <View style={{flexDirection:"row",justifyContent:"space-between"}}>
                        <Text style={[styles.topP,{color:c.sub}]}>{e.citas} cita{e.citas!==1?"s":""}</Text>
                        <Text style={[styles.topP,{color:c.sub}]}>{pct.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </ThemedCard>
                );
              })}
            </>)}

          </>)}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:    { padding:20, gap:16 },
  anioBtn:   { padding:6, borderRadius:8, borderWidth:1, alignItems:"center", justifyContent:"center" },
  anioTxt:   { fontSize:16, fontFamily:"Syne_700Bold", minWidth:60, textAlign:"center" },
  mesesGrid: { flexDirection:"row", flexWrap:"wrap", gap:6 },
  mesBtn:    { width:"22%", paddingVertical:7, alignItems:"center", borderRadius:8, borderWidth:1 },
  mesBtnTxt: { fontSize:11, fontFamily:"SpaceGrotesk_600SemiBold" },
  segRow:    { flexDirection:"row", borderRadius:12, borderWidth:1, overflow:"hidden" },
  segBtn:    { flex:1, paddingVertical:10, alignItems:"center", borderRadius:10 },
  segTxt:    { fontSize:12, fontFamily:"SpaceGrotesk_600SemiBold" },
  sec:       { fontSize:10, fontFamily:"SpaceGrotesk_500Medium", letterSpacing:1.5, marginTop:4 },
  kpiRow:    { flexDirection:"row", gap:10 },
  kpi:       { flex:1, gap:6, alignItems:"center" },
  kpiL:      { fontSize:10, fontFamily:"SpaceGrotesk_400Regular", textAlign:"center" },
  creditCard:{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:12, borderWidth:1, borderRadius:12 },
  topCard:   { gap:8 },
  topRow:    { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  topN:      { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold", flex:1, marginRight:8 },
  numSobrio: { fontSize:17, fontFamily:"SpaceGrotesk_500Medium" },
  topNum:    { fontSize:13, fontFamily:"SpaceGrotesk_500Medium" },
  barBg:     { height:6, borderRadius:3, width:"100%" },
  barFill:   { height:6, borderRadius:3 },
  topP:      { fontSize:11, fontFamily:"SpaceGrotesk_400Regular" },
  empCard:   { flexDirection:"row", alignItems:"flex-start", gap:12 },
  empAv:     { width:40, height:40, borderRadius:20, justifyContent:"center", alignItems:"center", marginTop:2 },
  empAvT:    { fontSize:13, fontFamily:"Syne_700Bold" },
  empty:     { alignItems:"center", marginTop:40, gap:12, paddingHorizontal:20 },
  emptyT:    { fontSize:18, fontFamily:"Syne_700Bold" },
  emptyD:    { fontSize:13, fontFamily:"SpaceGrotesk_400Regular", textAlign:"center" },
});
