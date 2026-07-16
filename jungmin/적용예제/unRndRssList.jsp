<%@ 
page import="java.io.*,javax.xml.transform.*,javax.xml.transform.stream.*,javax.xml.transform.dom.*
            ,javax.xml.parsers.*
			,org.w3c.dom.*"%><%@
page contentType="text/html; charset=UTF-8"%><%
    // 스크립트릿 간에 공백이 있어선 안됨. 그래서 위와같이 붙여서 표기함.
    
    // ServletContext 를 가져옴.
	ServletContext context = getServletContext();
    // xsl 파일위치 (첨부된 xsl 파일을 WEB-INF 밑에 xsl 라는 폴더를 만들어 위치시킴 - 각자 시스템 환경에 맞도록 설정)
    String xslurl = context.getRealPath("/WEB-INF/xsl/unRndRss.xsl");
    // xsl 파일을 가져옴.
    File xsl = new File(xslurl);
    
    // rss 문서를 Document 객체로 만든다.
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    DocumentBuilder builder = factory.newDocumentBuilder();    
    Document doc = builder.parse("http://www.ntis.go.kr/rndgate/eg/unRndRss.xml?prt=10"); 
    
    // TransformerFactory 를 이용하여 위에서 만든 rss문서객체와 xsl문서를 합쳐 하나의 문서내용을 출력한다.
    TransformerFactory f = TransformerFactory.newInstance();
	Transformer trans = f.newTransformer(new StreamSource(xsl));
	trans.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
	trans.transform(new DOMSource(doc), new StreamResult(out));
%>