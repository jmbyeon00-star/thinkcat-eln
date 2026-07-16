<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
    <xsl:template match="/">
        <html>
            <head>
                <title>XSLT 샘플데이터</title>
                <link href="rss_css/element.css" rel="stylesheet" type="text/css" />
                <link href="rss_css/layout.css"  rel="stylesheet" type="text/css" />
                <link href="rss_css/table_style.css"  rel="stylesheet" type="text/css" />
                <script language="javascript"> 
                    <xsl:comment> 
                    function detail(url) 
                    {                        
                        getListWin('740', '800', 'bzPop', '사업공고정보', url, '', '', '', '', '');
                    }
                    function getListWin(widthSize, heightSize, winNM, winTitle, url, formObjNM, nextObjNM, cdObjNM, nmObjNM, val) {
                        var width = widthSize;
                        var height = heightSize;
                        var left = (screen.width - width)/2;
                        var top = (screen.height - height)/2;
                        var windowFeatures = "width=" + width + ",height=" + height +
                        ",status,resizable,scrollbars,left=" + left + ",top=" + top +
                        ",screenX=" + left + ",screenY=" + top;                    
                        var win = window.open(url+ "&amp;winTitle=" + winTitle + "&amp;formObjNM=" + formObjNM
                        + "&amp;nextObjNM=" + nextObjNM
                        + "&amp;cdObjNM=" + cdObjNM
                        + "&amp;nmObjNM=" + nmObjNM
                        + "&amp;val=" + val, winNM, windowFeatures);
                    }
                    </xsl:comment> 
                </script> 
                
            </head>
            <body>
                
                <div class="content">
                    <table border="0" cellspacing="0" cellpadding="0" id="Tstyle" width="700">
                        <tr>
                            <td class="Theader">
                                <table border="0" cellspacing="0" cellpadding="0" id="Ttitle_num" width="700">
                                    <tr>
                                        <td class="numL"></td>
                                        <td class="num"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>                            
                        <tr>
                            <td class="content">
                                <table border="0" cellspacing="0" cellpadding="0" id="Tcontent">
                                    <tr>                            
                                        <td class="title" width="200">공고기관</td>
                                        <td class="title" width="300">제목</td>
                                        <td class="title" width="200">공고일</td>
                                    </tr>
                                    <xsl:apply-templates select="/rss/channel/item" />
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td class="Theader">
                                <table border="0" cellspacing="0" cellpadding="0" id="Ttitle_num" width="700">
                                    <tr>
                                        <td class="numL"></td>
                                        <td class="num"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>                    
                
            </body>
        </html>
    </xsl:template>
    
    <xsl:template match="item">
        <tr>
            <td class="listC"><xsl:value-of select="author" /></td>
            <td class="listL">
                <xsl:element name="a">
                    <xsl:attribute name = "href">javascript:detail('<xsl:value-of select="link"/>')</xsl:attribute>
                    <xsl:attribute name = "target">_parent</xsl:attribute>
                    <xsl:value-of select="title" />
                </xsl:element>
            </td>
            <td class="listC"><xsl:value-of select="pubDate" /></td>            
        </tr>
    </xsl:template>
    
</xsl:stylesheet>