////////////////////////////////////////////////////////////////////////
// CameraAttractionForce.cs


using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;


public class CameraAttractionForce: MonoBehaviour {


    ////////////////////////////////////////////////////////////////////////
    // Instance Variables


    public Rigidbody rb;
    public float cameraAttraction = 50f;


    void FixedUpdate()
    {
        if (rb == null) {
            rb = (Rigidbody)gameObject.GetComponentInParent(typeof(Rigidbody));
        }

        Vector3 toCamera =
            Camera.main.transform.position - 
            rb.transform.position;
        rb.AddForce(
            toCamera * (cameraAttraction / toCamera.magnitude),
            ForceMode.Force);
    }


}
